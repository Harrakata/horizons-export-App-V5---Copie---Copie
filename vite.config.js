import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Titre de l'app pour l'onglet, le meta iOS et le manifeste PWA.
// Format : "GestionPDV <client>" (ex. "GestionPDV SONAL", "GestionPDV PMU Mali").
// Sur Vercel, VITE_CLIENT_NAME est présent dans process.env au moment du build.
const PRODUCT_NAME = 'GestionPDV';
const CLIENT_NAME = (process.env.VITE_CLIENT_NAME || '').trim();
const APP_TITLE = CLIENT_NAME && CLIENT_NAME !== PRODUCT_NAME
	? `${PRODUCT_NAME} ${CLIENT_NAME}`
	: PRODUCT_NAME;

const configHorizonsViteErrorHandler = `
const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const addedNode of mutation.addedNodes) {
			if (
				addedNode.nodeType === Node.ELEMENT_NODE &&
				(
					addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
					addedNode.classList?.contains('backdrop')
				)
			) {
				handleViteOverlay(addedNode);
			}
		}
	}
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true
});

function handleViteOverlay(node) {
	if (!node.shadowRoot) {
		return;
	}

	const backdrop = node.shadowRoot.querySelector('.backdrop');

	if (backdrop) {
		const overlayHtml = backdrop.outerHTML;
		const parser = new DOMParser();
		const doc = parser.parseFromString(overlayHtml, 'text/html');
		const messageBodyElement = doc.querySelector('.message-body');
		const fileElement = doc.querySelector('.file');
		const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
		const fileText = fileElement ? fileElement.textContent.trim() : '';
		const error = messageText + (fileText ? ' File:' + fileText : '');

		window.parent.postMessage({
			type: 'horizons-vite-error',
			error,
		}, '*');
	}
}
`;

const configHorizonsRuntimeErrorHandler = `
window.onerror = (message, source, lineno, colno, errorObj) => {
	const errorDetails = errorObj ? JSON.stringify({
		name: errorObj.name,
		message: errorObj.message,
		stack: errorObj.stack,
		source,
		lineno,
		colno,
	}) : null;

	window.parent.postMessage({
		type: 'horizons-runtime-error',
		message,
		error: errorDetails
	}, '*');
};
`;

const configHorizonsConsoleErrroHandler = `
const originalConsoleError = console.error;
console.error = function(...args) {
	originalConsoleError.apply(console, args);

	let errorString = '';

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg instanceof Error) {
			errorString = arg.stack || \`\${arg.name}: \${arg.message}\`;
			break;
		}
	}

	if (!errorString) {
		errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
	}

	window.parent.postMessage({
		type: 'horizons-console-error',
		error: errorString
	}, '*');
};
`;

const configWindowFetchMonkeyPatch = `
const originalFetch = window.fetch;

window.fetch = function(...args) {
	const url = args[0] instanceof Request ? args[0].url : args[0];

	// Skip WebSocket URLs
	if (url.startsWith('ws:') || url.startsWith('wss:')) {
		return originalFetch.apply(this, args);
	}

	return originalFetch.apply(this, args)
		.then(async response => {
			const contentType = response.headers.get('Content-Type') || '';

			// Exclude HTML document responses
			const isDocumentResponse =
				contentType.includes('text/html') ||
				contentType.includes('application/xhtml+xml');

			if (!response.ok && !isDocumentResponse) {
					const responseClone = response.clone();
					const errorFromRes = await responseClone.text();
					const requestUrl = response.url;
					console.error(\`Fetch error from \${requestUrl}: \${errorFromRes}\`);
			}

			return response;
		})
		.catch(error => {
			if (!url.match(/\.html?$/i)) {
				console.error(error);
			}

			throw error;
		});
};
`;

const addTransformIndexHtml = {
	name: 'add-transform-index-html',
	transformIndexHtml(html) {
		// Injecte le nom du client dans le titre d'onglet et le titre PWA iOS.
		const htmlWithClientName = html
			.replace(/<title>[\s\S]*?<\/title>/, `<title>${APP_TITLE}</title>`)
			.replace(
				/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/,
				`$1${APP_TITLE}$2`
			);
		return {
			html: htmlWithClientName,
			tags: [
				{
					tag: 'script',
					attrs: { type: 'module' },
					children: configHorizonsRuntimeErrorHandler,
					injectTo: 'head',
				},
				{
					tag: 'script',
					attrs: { type: 'module' },
					children: configHorizonsViteErrorHandler,
					injectTo: 'head',
				},
				{
					tag: 'script',
					attrs: {type: 'module'},
					children: configHorizonsConsoleErrroHandler,
					injectTo: 'head',
				},
				{
					tag: 'script',
					attrs: { type: 'module' },
					children: configWindowFetchMonkeyPatch,
					injectTo: 'head',
				},
			],
		};
	},
};

console.warn = () => {};

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

export default defineConfig({
	customLogger: logger,
	plugins: [
		react(),
		addTransformIndexHtml,
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['carrus-logo.png', 'pwa-icon.svg', 'apple-touch-icon.png'],
			manifest: {
				name: APP_TITLE,
				short_name: APP_TITLE,
				description: 'Gestion des points de vente : planning, pointage, paiements et maintenance.',
				lang: 'fr',
				theme_color: '#2563eb',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{ src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
					{ src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
				],
			},
			workbox: {
				navigateFallback: 'index.html',
				// Ne pas intercepter le viewer Power BI ni les appels d'API
				navigateFallbackDenylist: [/^\/pbi-viewer/],
				globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
			},
		}),
	],
	server: {
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: true,
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		// Minification terser : on supprime console.* et debugger en prod
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
			},
		},
		// Avertit si un chunk dépasse 600 KB (au lieu du défaut 500)
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			output: {
				// Regroupement intelligent des dépendances en chunks séparés
				// pour optimiser le cache navigateur entre déploiements
				manualChunks: {
					'vendor-react'    : ['react', 'react-dom', 'react-router-dom'],
					'vendor-radix'    : [
						'@radix-ui/react-alert-dialog',
						'@radix-ui/react-avatar',
						'@radix-ui/react-checkbox',
						'@radix-ui/react-dialog',
						'@radix-ui/react-dropdown-menu',
						'@radix-ui/react-label',
						'@radix-ui/react-popover',
						'@radix-ui/react-radio-group',
						'@radix-ui/react-select',
						'@radix-ui/react-separator',
						'@radix-ui/react-slider',
						'@radix-ui/react-slot',
						'@radix-ui/react-tabs',
						'@radix-ui/react-toast',
						'@radix-ui/react-tooltip',
					],
					'vendor-supabase' : ['@supabase/supabase-js'],
					'vendor-charts'   : ['recharts'],
					'vendor-motion'   : ['framer-motion'],
					'vendor-icons'    : ['lucide-react'],
					'vendor-date'     : ['date-fns', 'react-day-picker'],
					'vendor-powerbi'  : ['powerbi-client', '@azure/msal-browser'],
				},
			},
		},
	},
});

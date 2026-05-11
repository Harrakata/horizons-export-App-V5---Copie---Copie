import { supabase } from '@/lib/supabaseClient';

/**
 * Ajoute un sous-ensemble remplacé lors d'une maintenance curative au stock défectueux.
 * À appeler depuis le formulaire d'enregistrement d'intervention curative.
 *
 * @param {object} params
 * @param {string} params.referenceSousEnsemble - Référence de l'équipement (ex: "IMP-001")
 * @param {string} params.typeSousEnsemble - Type : 'imprimante' | 'lecteur' | 'ecran' | 'afficheur'
 * @param {string} params.typeTerminal - Type terminal : '2020' | '2031'
 * @param {string|number} params.agenceProvenance - ID de l'agence de provenance
 * @param {string} params.dateEntree - Date de l'intervention (ISO string)
 * @param {string} params.commentaire - Commentaire de remplacement
 * @param {string|number} [params.interventionId] - ID de l'intervention liée
 * @returns {Promise<{data, error}>}
 */
export const ajouterAuStockDefectueux = async ({
  referenceSousEnsemble,
  typeSousEnsemble,
  typeTerminal,
  agenceProvenance,
  dateEntree,
  commentaire,
  interventionId,
}) => {
  if (!referenceSousEnsemble || !typeSousEnsemble) {
    return { data: null, error: new Error('Référence et type de sous-ensemble requis.') };
  }

  const payload = {
    reference_sous_ensemble: referenceSousEnsemble,
    type_sous_ensemble: typeSousEnsemble,
    type_terminal: typeTerminal || null,
    statut: 'defectueux',
    agence_provenance_id: agenceProvenance || null,
    date_entree: dateEntree || new Date().toISOString(),
    commentaire: commentaire || null,
    intervention_id: interventionId || null,
  };

  return supabase.from('stock_defectueux').insert(payload).select().single();
};

/**
 * Met à jour le statut d'un sous-ensemble défectueux dans le stock.
 * Règle : seul l'espace Exploitation peut modifier le stock.
 */
export const updateStatutStockDefectueux = async (id, statut) => {
  const updates = { statut };
  if (statut === 'repare') {
    updates.date_sortie = new Date().toISOString();
  }
  return supabase.from('stock_defectueux').update(updates).eq('id', id);
};

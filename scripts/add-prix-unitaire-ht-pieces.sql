alter table public.pieces_sous_ensembles
  add column if not exists prix_unitaire_ht numeric(12, 2) not null default 0;

comment on column public.pieces_sous_ensembles.prix_unitaire_ht
  is 'Prix unitaire HT utilise pour les devis pieces.';

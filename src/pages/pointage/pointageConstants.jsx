import React from 'react';

export const INITIAL_SETTINGS = {
  nombrePointagesRequis: 3,
  creneauxPointage: [
    { debut: "09:00", fin: "11:00" },
    { debut: "13:00", fin: "15:00" },
    { debut: "17:00", fin: "19:00" }
  ],
  rappelDebutCreneau: true,
  rappelFinCreneau: true,
  isPointageCentraliseActif: true, 
  sessionDureeMinutes: 30, // Durée de session par défaut en minutes
};

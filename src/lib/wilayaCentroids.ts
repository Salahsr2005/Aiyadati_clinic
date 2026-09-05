// Approximate centroid coordinates for Algeria's 58 wilayas keyed by code.
// Values are [longitude, latitude]. Accuracy is good enough for map bubbles.
export const WILAYA_CENTROIDS: Record<number, [number, number]> = {
  1: [0.1500, 27.8742],   // Adrar
  2: [1.3200, 36.0800],   // Chlef
  3: [2.8664, 34.8500],   // Laghouat
  4: [7.1167, 35.8756],   // Oum El Bouaghi
  5: [6.1739, 35.5559],   // Batna
  6: [5.0833, 36.7525],   // Béjaïa
  7: [5.7333, 34.8500],   // Biskra
  8: [-1.3167, 31.6167],  // Béchar
  9: [2.8277, 36.4700],   // Blida
  10: [3.6800, 36.4600],  // Bouira
  11: [5.4200, 22.7850],  // Tamanrasset
  12: [8.1167, 35.4000],  // Tébessa
  13: [-1.3167, 34.8783], // Tlemcen
  14: [1.3167, 35.3717],  // Tiaret
  15: [4.0500, 36.7167],  // Tizi Ouzou
  16: [3.0588, 36.7538],  // Alger
  17: [3.6739, 34.7936],  // Djelfa
  18: [5.7667, 36.8167],  // Jijel
  19: [5.4136, 36.1919],  // Sétif
  20: [0.6300, 34.8664],  // Saïda
  21: [6.6147, 36.8781],  // Skikda
  22: [-0.6417, 35.2000], // Sidi Bel Abbès
  23: [7.7667, 36.9000],  // Annaba
  24: [7.4356, 36.4514],  // Guelma
  25: [6.6147, 36.3650],  // Constantine
  26: [2.7500, 36.2667],  // Médéa
  27: [0.1400, 35.9300],  // Mostaganem
  28: [4.5417, 35.7025],  // MSila
  29: [0.1500, 35.4000],  // Mascara
  30: [5.3350, 31.9539],  // Ouargla
  31: [-0.6392, 35.6969], // Oran
  32: [1.3167, 33.1667],  // El Bayadh
  33: [8.4500, 26.5000],  // Illizi
  34: [4.7581, 36.0731],  // Bordj Bou Arréridj
  35: [3.6900, 36.7658],  // Boumerdès
  36: [8.2489, 36.7500],  // El Tarf
  37: [-3.2833, 27.6742], // Tindouf
  38: [1.4667, 35.4667],  // Tissemsilt
  39: [5.9578, 33.6867],  // El Oued
  40: [7.1500, 35.4000],  // Khenchela
  41: [8.1167, 36.2833],  // Souk Ahras
  42: [1.9167, 36.5892],  // Tipaza
  43: [6.2667, 36.4667],  // Mila
  44: [2.0803, 36.2647],  // Aïn Defla
  45: [-0.2833, 32.8300], // Naâma
  46: [-1.1481, 35.2967], // Aïn Témouchent
  47: [2.8756, 32.4842],  // Ghardaïa
  48: [0.1200, 35.7300],  // Relizane
  49: [1.0333, 32.6867],  // El MGhair
  50: [7.0500, 33.5000],  // El Meniaa
  51: [5.3300, 29.2467],  // Ouled Djellal
  52: [-2.1667, 30.1000], // Bordj Baji Mokhtar
  53: [8.4667, 30.5711],  // Béni Abbès
  54: [1.3333, 27.8500],  // Timimoun
  55: [3.2500, 27.2000],  // Touggourt
  56: [1.4500, 22.5000],  // Djanet
  57: [-3.2000, 27.2000], // In Salah
  58: [1.5500, 20.7833],  // In Guezzam
};

export function centroidFor(code?: number | null): [number, number] | null {
  if (code == null) return null;
  return WILAYA_CENTROIDS[code] ?? null;
}

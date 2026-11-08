/** "35,5 DT": an amount in Tunisian dinars for messages (up to 3 decimals, French separators) */
export const formatTnd = (amount) =>
  `${Number(amount).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} DT`;

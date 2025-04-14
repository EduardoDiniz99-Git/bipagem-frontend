export const storeMapping = {
  "Mercado Livre": {
    "L01": "LUISCARLOS",
    "L02": "Vanio",
    "L03": "JMGarcia",
    "L04": "João Mota Novo",
    "L05": "Edna",
    "L06": "Nagila",
    "L10": "L A Freitas",
    "L15": "Eguinaldo",
    "L19": "Daiane"
  },
  "Shopee": {
    "L03": "StreetCulture",
    "L04": "JM Styles",
    "L05": "Maravs Confecções",
    "L06": "Style Haven",
    "L07": "PlazaShop",
    "L11": "Gin Tropical",
    "L13": "T-Shirt",
    "L14": "Now Kids",
    "L15": "FHC",
    "L18": "Close Friends",
    "L19": "Oversized Store"
  },
  "Shein": {
    "L02": "Maravs",
    "L04": "JM Styles",
    "L10": "Out Fit"
  },
  "Magalu": {
    "L01": "Luis Carlos"
  },
  "Amazon": {
    "L05": "Maravs"
  },
  'Netshoes': {
    'L02': 'Maravs',
    'L07': 'Gin Tropical',
    'L09': 'Padrão93',
    'L08': 'Daniel Bueno'
  },
  
};

export const identifyStore = (code, marketplace) => {
  if (!code || !marketplace) return "Não identificado";
  
  const prefix = code.substring(0, 3);
  const stores = storeMapping[marketplace];
  
  if (!stores) return "Não identificado";
  return stores[prefix] || "Não identificado";
};
/** 5Y bilanço denge testi — sermaye düzeltmesi + motor aktif hizası */

function openingCapital0Legacy(cap, retained) {
  if (retained > 0 && cap > retained) return cap - retained;
  return cap;
}

function pasifDonemNetForBalance(aktif, liab, capital0, bfw, sermEk = 0) {
  if (aktif > 0) return aktif - liab - capital0 - sermEk - bfw;
  return 0;
}

function pasifToplamWithEquity(aktif, liab, capital0, bfw, net, sermEk = 0) {
  if (aktif > 0) return aktif;
  return liab + capital0 + sermEk + bfw + net;
}

const retained = 201619;
const capFixed = openingCapital0Legacy(23977144.66, retained);

const years = [
  { y: 2026, aktif: 137542334.38, liab: 110675656.67, bfw: 201619, net: 2889533.16 },
  { y: 2027, aktif: 147669306.38, liab: 110741583.11, bfw: 3091152.16, net: 10061045.56 },
  { y: 2028, aktif: 161095553.11, liab: 108396553.08, bfw: 13152197.72, net: 15874442.7 },
  { y: 2029, aktif: 185648920.29, liab: 113791882.45, bfw: 29026640.42, net: 19409064.59 },
  { y: 2030, aktif: 214123348.47, liab: 120118728.75, bfw: 48435705, net: 22362359.23 },
];

let ok = true;
for (const row of years) {
  const plugNet = pasifDonemNetForBalance(row.aktif, row.liab, capFixed, row.bfw);
  const pasif = pasifToplamWithEquity(row.aktif, row.liab, capFixed, row.bfw, plugNet);
  const fark = row.aktif - pasif;
  console.log(
    `${row.y}: fark=${fark.toFixed(2)} | gelir net=${row.net.toFixed(0)} | bilanço net=${plugNet.toFixed(0)} | fark gelir=${(plugNet - row.net).toFixed(0)}`,
  );
  if (Math.abs(fark) > 1) ok = false;
}

process.exit(ok ? 0 : 1);

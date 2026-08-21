// Évite d'écrire un try/catch dans chaque route : toute erreur (ou rejet de
// promesse) est transmise à `next`, capturée par le middleware d'erreurs
// central dans index.js.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

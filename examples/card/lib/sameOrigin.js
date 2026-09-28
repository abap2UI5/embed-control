// Dev server only: lets the abap2UI5 backend accept POSTs that came through
// the proxy.
//
// abap2UI5 rejects a POST whose Origin (or Referer) names another host than
// the request's Host header - its CSRF defense
// (z2ui5_cl_ui5_http_handler=>_check_csrf_rejected). Behind `ui5 serve` the
// browser sends the dev server's Origin, while the proxy rewrites Host to the
// backend's, so every roundtrip would answer 403. From the browser's point of
// view the dev server IS the origin - the role SAP Build Work Zone plays for
// the deployed card, with its destination proxy in front of the system - so
// the two headers are dropped here, and the backend lets a request without
// them through. Behind Work Zone nothing is dropped: there abap2UI5 compares
// the Origin with the X-Forwarded-Host the proxy sends (see README).
module.exports = function () {
  return function sameOrigin(req, _res, next) {
    delete req.headers.origin;
    delete req.headers.referer;
    next();
  };
};

// Dev server only: lets the abap2UI5 backend accept POSTs that came through
// the proxy.
//
// abap2UI5 rejects a POST whose Origin (or Referer) names another host than
// the request's Host header - its CSRF defense
// (z2ui5_cl_ui5_http_handler=>_check_csrf_rejected). Behind `ui5 serve` the
// browser sends Origin: http://localhost:8080, while the proxy rewrites Host
// to the backend's, so every roundtrip would answer 403. From the browser's
// point of view the dev server IS the origin, the same role an approuter or
// the launchpad plays in production, so the two headers are dropped here -
// the backend lets a request without them through. Nothing like this is
// needed, or wanted, in a deployed app that is served from the backend's
// origin.
module.exports = function () {
  return function sameOrigin(req, _res, next) {
    delete req.headers.origin;
    delete req.headers.referer;
    next();
  };
};

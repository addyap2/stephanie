// Footer year for the legal pages (kept external so the CSP needs no inline-script allowance).
(function () {
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

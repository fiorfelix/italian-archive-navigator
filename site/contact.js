// Contact form helpers: pre-select the topic from ?topic=..., and show progress on submit.
(function () {
  var topic = new URLSearchParams(window.location.search).get('topic');
  if (topic) {
    var radio = document.getElementById('t-' + topic);
    if (radio) radio.checked = true;
  }
  var form = document.querySelector('form.contact');
  if (!form) return;
  form.addEventListener('submit', function () {
    var button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = button.getAttribute('data-sending') || 'Sending…';
    }
  });
})();

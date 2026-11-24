// Copy buttons: <button data-copy="element-id"> copies that element's text.
(function () {
  document.querySelectorAll('button[data-copy]').forEach(function (button) {
    var label = button.textContent;
    button.addEventListener('click', function () {
      var source = document.getElementById(button.getAttribute('data-copy'));
      if (!source) return;
      var text = source.textContent.trim();
      var done = function () {
        button.textContent = 'Copied ✓';
        setTimeout(function () {
          button.textContent = label;
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          window.getSelection().selectAllChildren(source);
        });
      } else {
        window.getSelection().selectAllChildren(source);
      }
    });
  });
})();

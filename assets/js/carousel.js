document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var stage = root.querySelector('.carousel-media');
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('.carousel-thumb'));
    var nextBtn = root.querySelector('.carousel-next');
    var current = 0;

    function show(index) {
      if (!thumbs.length) return;
      current = (index + thumbs.length) % thumbs.length;
      var thumb = thumbs[current];
      var type = thumb.getAttribute('data-type');
      var src = thumb.getAttribute('data-src');

      stage.innerHTML = '';
      if (type === 'video') {
        var video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        var poster = thumb.getAttribute('data-poster');
        if (poster) video.poster = poster;
        stage.appendChild(video);
      } else {
        var img = document.createElement('img');
        img.src = src;
        img.alt = thumb.getAttribute('data-alt') || '';
        stage.appendChild(img);
      }

      thumbs.forEach(function (t, i) {
        t.classList.toggle('active', i === current);
      });
    }

    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function () {
        show(i);
      });
    });

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        show(current + 1);
      });
    }

    show(0);
  });
});

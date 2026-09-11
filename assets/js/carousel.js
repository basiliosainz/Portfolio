document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var folder = root.getAttribute('data-media-folder');
    if (folder) {
      initFromFolder(root, folder);
    } else {
      initCarousel(root);
    }
  });

  function initFromFolder(root, folder) {
    var thumbsWrap = root.querySelector('.carousel-thumbs');
    var base = folder.replace(/\/$/, '');

    fetch(base + '/manifest.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('manifest not found: ' + base);
        return res.json();
      })
      .then(function (items) {
        if (!items || !items.length) {
          root.hidden = true;
          return;
        }
        thumbsWrap.innerHTML = items
          .map(function (item) {
            var src = base + '/' + item.file;
            var alt = item.alt || '';
            if (item.type === 'video') {
              return (
                '<button class="carousel-thumb is-video" type="button" data-type="video" data-src="' +
                src +
                '" data-alt="' +
                escapeAttr(alt) +
                '">' +
                '<video class="carousel-thumb-video" src="' +
                src +
                '#t=0.5" muted playsinline preload="metadata"></video>' +
                '<span class="carousel-thumb-play" aria-hidden="true"></span>' +
                '</button>'
              );
            }
            return (
              '<button class="carousel-thumb" type="button" data-type="image" data-src="' +
              src +
              '" data-alt="' +
              escapeAttr(alt) +
              '" style="background-image:url(\'' +
              src +
              '\')"></button>'
            );
          })
          .join('');
        initCarousel(root);
      })
      .catch(function (err) {
        console.warn('Carousel: could not load media for', folder, err);
        root.hidden = true;
      });
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function initCarousel(root) {
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
  }
});

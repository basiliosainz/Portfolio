document.addEventListener('DOMContentLoaded', function () {
  var lightbox = createLightbox();

  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var stage = root.querySelector('.carousel-media');
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('.carousel-thumb'));
    var nextBtn = root.querySelector('.carousel-next');
    var prevBtn = root.querySelector('.carousel-prev');
    var current = 0;

    function show(index) {
      if (!thumbs.length) return;
      current = (index + thumbs.length) % thumbs.length;
      renderMediaInto(stage, thumbs[current]);

      thumbs.forEach(function (t, i) {
        t.classList.toggle('active', i === current);
      });

      thumbs[current].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });

      if (lightbox.isOpenFor(root)) {
        lightbox.render(thumbs[current]);
      }
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

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        show(current - 1);
      });
    }

    stage.addEventListener('click', function () {
      if (!thumbs.length) return;
      lightbox.open(root, thumbs[current], {
        next: function () {
          show(current + 1);
        },
        prev: function () {
          show(current - 1);
        },
      });
    });

    show(0);
  });
});

function renderMediaInto(container, thumb) {
  var type = thumb.getAttribute('data-type');
  var src = thumb.getAttribute('data-src');

  container.innerHTML = '';
  if (type === 'video') {
    var video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    container.appendChild(video);
  } else {
    var img = document.createElement('img');
    img.src = src;
    img.alt = thumb.getAttribute('data-alt') || '';
    container.appendChild(img);
  }
}

function createLightbox() {
  var overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Close">&times;</button>' +
    '<button class="lightbox-prev" type="button" aria-label="Previous">&lsaquo;</button>' +
    '<div class="lightbox-content"></div>' +
    '<button class="lightbox-next" type="button" aria-label="Next">&rsaquo;</button>';
  document.body.appendChild(overlay);

  var content = overlay.querySelector('.lightbox-content');
  var activeRoot = null;
  var handlers = null;

  function close() {
    overlay.hidden = true;
    content.innerHTML = '';
    activeRoot = null;
    handlers = null;
    document.body.classList.remove('lightbox-open');
  }

  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.lightbox-prev').addEventListener('click', function () {
    if (handlers) handlers.prev();
  });
  overlay.querySelector('.lightbox-next').addEventListener('click', function () {
    if (handlers) handlers.next();
  });
  document.addEventListener('keydown', function (e) {
    if (overlay.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && handlers) handlers.next();
    else if (e.key === 'ArrowLeft' && handlers) handlers.prev();
  });

  return {
    open: function (root, thumb, h) {
      activeRoot = root;
      handlers = h;
      renderMediaInto(content, thumb);
      overlay.hidden = false;
      document.body.classList.add('lightbox-open');
    },
    render: function (thumb) {
      renderMediaInto(content, thumb);
    },
    isOpenFor: function (root) {
      return !overlay.hidden && activeRoot === root;
    },
  };
}

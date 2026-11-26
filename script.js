"use strict";

/* ------------------------------------------------------------------
   Contact details are assembled here so simple bots cannot scrape them
   from the HTML. Edit them in this one place.
------------------------------------------------------------------- */
const CONTACT = {
  email: ["rafihossain242", "gmail.com"].join("@"),
  phone: ["+880", "18346785410"].join("-"),
};

function fillContact() {
  document.querySelectorAll("[data-email]").forEach((el) => {
    el.href = `mailto:${CONTACT.email}`;
  });
  document.querySelectorAll("[data-email-text]").forEach((el) => {
    el.textContent = CONTACT.email;
  });
  document.querySelectorAll("[data-phone]").forEach((el) => {
    el.href = `tel:${CONTACT.phone.replace(/-/g, "")}`;
    el.textContent = CONTACT.phone;
  });
}

function fillYear() {
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
}

/* ------------------------------------------------------------------
   Endless auto-sliding carousel.
   The screenshots are cloned before and after the originals, so the
   strip never runs out. It moves on its own, pauses on hover, touch,
   keyboard focus and when off screen, and can be dragged or paused.
------------------------------------------------------------------- */
const SPEED = 40; // pixels per second

function initCarousel(gallery) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = Array.from(gallery.children);
  if (!items.length) return;

  const bar = buildBar(items.length, reduceMotion);
  gallery.parentElement.insertBefore(bar.element, gallery);

  // With reduced motion the strip stays still and scrolls by hand only.
  if (reduceMotion) return;

  items.forEach((item, i) => item.classList.toggle("raised", i % 2 === 1));
  const before = items.map(cloneInert);
  const after = items.map(cloneInert);
  gallery.prepend(...before);
  gallery.append(...after);
  gallery.classList.add("is-looping");

  const hold = { user: false, hover: false, focus: false, button: false, offscreen: true };
  let period = 0;   // width of one full set of screenshots
  let pos = 0;      // our own float scroll position
  let last = performance.now();
  let drag = null;
  let holdTimer = 0;

  const isRunning = () => !document.hidden && !Object.values(hold).some(Boolean);

  function measure() {
    period = items[0].offsetLeft - before[0].offsetLeft;
    pos = period;
    gallery.scrollLeft = period;
  }

  function setHold(key, value) {
    hold[key] = value;
    if (!value) pos = gallery.scrollLeft;
  }

  function holdWhileUserScrolls() {
    hold.user = true;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => setHold("user", false), 1800);
  }

  // Keep the view inside the middle set; the sets look identical, so no jump is visible.
  function wrap() {
    const x = gallery.scrollLeft;
    let shift = 0;
    if (x >= period * 2) shift = -period;
    else if (x < period) shift = period;
    if (shift) {
      gallery.scrollLeft = x + shift;
      if (drag) drag.left += shift;
    }
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (isRunning()) {
      pos += SPEED * dt;
      if (pos >= period * 2) pos -= period;
      gallery.scrollLeft = pos;
    }
    requestAnimationFrame(tick);
  }

  gallery.addEventListener("scroll", () => {
    if (isRunning()) return;
    wrap();
    pos = gallery.scrollLeft;
    holdWhileUserScrolls();
  }, { passive: true });

  gallery.addEventListener("wheel", holdWhileUserScrolls, { passive: true });
  gallery.addEventListener("touchstart", holdWhileUserScrolls, { passive: true });

  gallery.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") setHold("hover", true); });
  gallery.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setHold("hover", false); });

  gallery.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) setHold("focus", true); });
  gallery.addEventListener("focusout", () => setHold("focus", false));

  // Mouse drag to scroll (touch and trackpad already scroll natively).
  gallery.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, left: gallery.scrollLeft };
    gallery.setPointerCapture(e.pointerId);
    gallery.classList.add("is-dragging");
  });
  gallery.addEventListener("pointermove", (e) => {
    if (drag) gallery.scrollLeft = drag.left - (e.clientX - drag.x);
  });
  const endDrag = () => {
    drag = null;
    gallery.classList.remove("is-dragging");
  };
  gallery.addEventListener("pointerup", endDrag);
  gallery.addEventListener("pointercancel", endDrag);

  bar.button.addEventListener("click", () => {
    setHold("button", !hold.button);
    setPauseState(bar.button, hold.button);
  });

  new IntersectionObserver((entries) => {
    setHold("offscreen", !entries[entries.length - 1].isIntersecting);
  }).observe(gallery);

  window.addEventListener("resize", measure);

  measure();
  requestAnimationFrame(tick);
}

// The pause button is an icon only; CSS draws the bars or the triangle.
function setPauseState(button, isPaused) {
  button.classList.toggle("is-paused", isPaused);
  button.setAttribute("aria-label", isPaused ? "Play slideshow" : "Pause slideshow");
  button.title = isPaused ? "Play" : "Pause";
}

function cloneInert(node) {
  const clone = node.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  return clone;
}

function buildBar(count, reduceMotion) {
  const element = document.createElement("div");
  element.className = "carousel-bar";

  const hint = document.createElement("p");
  hint.textContent = reduceMotion
    ? `${count} screens. Scroll sideways to see them all.`
    : `${count} screens. Drag or swipe to look around.`;
  element.append(hint);

  let button = null;
  if (!reduceMotion) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "pause";
    setPauseState(button, false);
    element.append(button);
  }
  return { element, button };
}

/* ------------------------------------------------------------------
   Mobile card deck (phones only; CSS hides it on larger screens).
   Screenshots become a stack of cards that fly away on their own, on
   tap or on swipe, with story style progress bars underneath.
------------------------------------------------------------------- */
const MOBILE = window.matchMedia("(max-width: 759px)");
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)");
const DECK_MS = 2800;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function initDeck(gallery) {
  const figures = Array.from(gallery.children);
  const n = figures.length;
  if (n < 4) return;

  const deck = el("div", "deck");
  deck.style.setProperty("--ms", `${DECK_MS}ms`);
  const stage = el("div", "deck-stage");
  stage.tabIndex = 0;
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", `${gallery.getAttribute("aria-label")}. Tap or swipe for the next one.`);

  const names = figures.map((f) => f.querySelector("figcaption").textContent);
  const cards = figures.map((fig) => {
    const card = el("div", "card");
    card.append(fig.querySelector("img").cloneNode());
    stage.append(card);
    return card;
  });

  const stories = el("ol", "stories");
  stories.setAttribute("aria-hidden", "true");
  const segs = names.map(() => {
    const li = el("li");
    li.append(el("i"));
    stories.append(li);
    return li;
  });

  const caption = el("p", "deck-caption");
  const count = el("span");
  const name = el("strong");
  caption.append(count, name);
  const pause = el("button", "pause");
  pause.type = "button";
  setPauseState(pause, false);
  const row = el("div", "deck-row");
  row.append(caption, pause);

  const meta = el("div", "deck-meta");
  meta.append(stories, row);
  deck.append(stage, meta);
  gallery.parentElement.insertBefore(deck, gallery);

  let current = 0, busy = false, dragging = false, running = false;
  let paused = false, visible = false, startX = 0, dx = 0, auto = 0, settle = 0;

  const canRun = () => !paused && visible && !dragging && !document.hidden && !REDUCE.matches;

  function render(outIndex = -1, side = "l") {
    cards.forEach((card, i) => {
      const rank = (i - current + n) % n;
      card.dataset.p = i === outIndex ? `out-${side}` : String(Math.min(rank, 3));
      card.setAttribute("aria-hidden", rank === 0 ? "false" : "true");
    });
  }

  function paint() {
    segs.forEach((li, i) => {
      li.classList.toggle("done", i < current);
      li.classList.remove("active");
    });
    void deck.offsetWidth; // restart the progress animation
    segs[current].classList.add("active");
    count.textContent = `${current + 1} / ${n}`;
    name.textContent = names[current];
  }

  function schedule() {
    clearTimeout(auto);
    const run = canRun();
    deck.classList.toggle("is-paused", !run);
    if (run) {
      if (!running) paint();
      auto = setTimeout(() => advance("l"), DECK_MS);
    }
    running = run;
  }

  function advance(side) {
    if (busy) return;
    busy = true;
    setTimeout(() => { busy = false; }, 450);
    const previous = current;
    current = (current + 1) % n;
    render(previous, side);
    clearTimeout(settle);
    settle = setTimeout(() => render(), 700);
    paint();
    schedule();
  }

  stage.addEventListener("pointerdown", (e) => {
    if (busy) return;
    dragging = true;
    startX = e.clientX;
    dx = 0;
    stage.setPointerCapture(e.pointerId);
    cards[current].classList.add("is-dragging");
    schedule();
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    cards[current].style.transform = `translateX(${dx}px) rotate(${dx / 16}deg)`;
  });
  function release(allowAdvance) {
    if (!dragging) return;
    dragging = false;
    const card = cards[current];
    card.classList.remove("is-dragging");
    card.style.transform = "";
    if (allowAdvance && (Math.abs(dx) > 60 || Math.abs(dx) < 6)) advance(dx < 0 ? "l" : "r");
    else schedule();
  }
  stage.addEventListener("pointerup", () => release(true));
  stage.addEventListener("pointercancel", () => release(false));
  stage.addEventListener("keydown", (e) => {
    if (["Enter", " ", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      advance("l");
    }
  });

  pause.addEventListener("click", () => {
    paused = !paused;
    setPauseState(pause, paused);
    schedule();
  });
  document.addEventListener("visibilitychange", schedule);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    schedule();
  }, { threshold: 0.4 }).observe(stage);

  render();
  paint();
}

/* ------------------------------------------------------------------
   Mobile extras: scroll reveal, number count-up, bottom tab bar.
   The styles for these live inside the mobile media query, so on
   desktop they do nothing.
------------------------------------------------------------------- */
function initReveal() {
  const selector = [
    ".section > h2", ".section-head h2", ".lead", ".content > p", ".facts > div", ".skills > div",
    ".group", ".timeline li", ".contact-list li", ".contact-cta", ".project-title", ".project-info > *",
  ].join(",");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

  document.querySelectorAll(selector).forEach((node) => {
    const index = Array.from(node.parentElement.children).indexOf(node);
    node.style.setProperty("--d", `${Math.min(index, 5) * 70}ms`);
    node.classList.add("reveal");
    observer.observe(node);
  });
}

function initCountUp() {
  document.querySelectorAll(".facts dt").forEach((node) => {
    const text = node.textContent.trim();
    const target = parseFloat(text);
    const decimals = (text.split(".")[1] || "").length;
    if (Number.isNaN(target) || !MOBILE.matches || REDUCE.matches) return;

    node.textContent = (0).toFixed(decimals);
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now) => {
        const k = Math.min((now - start) / 1100, 1);
        node.textContent = k < 1 ? (target * (1 - Math.pow(1 - k, 3))).toFixed(decimals) : text;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.8 });
    observer.observe(node);
  });
}

function initTabbar() {
  const tabs = Array.from(document.querySelectorAll(".tabbar a"));
  if (!tabs.length) return;
  const tabFor = { top: "top", projects: "projects", about: "about", skills: "skills", education: "skills", contact: "contact" };
  const setActive = (id) => tabs.forEach((a) => {
    if (a.dataset.tab === tabFor[id]) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.dataset.sec); });
  }, { rootMargin: "-45% 0px -50% 0px" });

  const sections = [["top", document.querySelector(".hero")]].concat(
    ["projects", "about", "skills", "education", "contact"].map((id) => [id, document.getElementById(id)])
  );
  sections.forEach(([id, node]) => {
    if (!node) return;
    node.dataset.sec = id;
    observer.observe(node);
  });
  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive("contact");
  }, { passive: true });
  setActive("top");
}

/* ------------------------------------------------------------------
   Hero text motion: the name rises letter by letter, the intro appears
   word by word. Skipped when the visitor prefers reduced motion.
------------------------------------------------------------------- */
function initHeroMotion() {
  const hero = document.querySelector(".hero");
  if (!hero || REDUCE.matches) return;

  let index = 0;
  hero.querySelectorAll("h1 .wi").forEach((word) => {
    const text = word.textContent;
    word.textContent = "";
    for (const char of text) {
      const letter = el("span", "ch", char);
      letter.style.setProperty("--i", index++);
      word.append(letter);
    }
  });

  const intro = hero.querySelector(".hero-sub");
  if (intro) {
    const words = intro.textContent.trim().split(/\s+/);
    intro.textContent = "";
    words.forEach((text, i) => {
      const word = el("span", "sw", text);
      word.style.setProperty("--i", i);
      intro.append(word);
      if (i < words.length - 1) intro.append(" ");
    });
  }
  hero.classList.add("has-motion");
}

/* ------------------------------------------------------------------ */
initHeroMotion();
fillContact();
fillYear();
document.querySelectorAll(".gallery").forEach((gallery) => {
  initDeck(gallery);      // must run first: it reads the original screenshots
  initCarousel(gallery);
});
initReveal();
initCountUp();
initTabbar();

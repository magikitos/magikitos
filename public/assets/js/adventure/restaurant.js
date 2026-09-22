"use strict";
const { el, button } = require("./dom");
const { activity } = require("./activities");
const { ratingView } = require("./ratings");
const { operationId } = require("./ids");

const LANGUAGES = ["es", "en", "de", "fr", "it", "pt"];
/** Each language written in itself, as a language menu should read. */
const languageName = code => new Intl.DisplayNames([code], { type: "language" }).of(code);

/** Website-owned recipes, rendered as native game cards. Drafts stay in this browser only;
 * the website validates identity and ingredients. Seats never gate personal publication. */
class Restaurant {
  constructor(game) { this.game = game; this.draft = null; this.data = null; this.recording = null; this.seen = new Set(); this.queue = []; this.round = 1; }
  open(filters = {}) {
    const g = this.game;
    return g.site.load("restaurant", g.text("restaurant"), async signal => {
      const data = this.data = await g.api.request("recipes", filters, { signal });
      const l = data.labels, root = activity(g, "restaurant", l.title);
      root.append(el("p", { text: l.intro, class: "world-experience-byline" }));
      const query = el("input", { type: "search", value: filters.q || "", maxlength: 100, placeholder: l.search, "aria-label": l.search });
      const ingredients = el("select", { "aria-label": l.ingredients }, [el("option", { value: "", text: l.all })]);
      for (const ingredient of data.ingredients) ingredients.append(el("option", { value: ingredient.id, text: ingredient.name }));
      ingredients.value = filters.ingredient || "";
      const form = el("form", { class: "world-native-search", on: { submit: e => { e.preventDefault(); this.open({ q: query.value.trim(), ingredient: ingredients.value }); } } },
        [query, ingredients, el("button", { type: "submit", text: l.search })]);
      root.append(form, button(l.publish, () => this.compose(), "world-primary"), button(l.another, () => this.next()));
      root.append(el("h2", { text: l.ranking }));
      const list = el("div", { class: "world-native-list" });
      const append = rows => { for (const item of rows) list.append(button(item.title, () => this.show(item))); };
      append(data.items);
      if (!data.items.length) list.append(el("p", { text: l.empty }));
      root.append(list);
      if (data.nextCursor !== null) {
        let cursor = data.nextCursor;
        const more = button(l.next, async () => {
          more.disabled = true;
          try { const page = await g.api.request("recipes", { ...filters, cursor }, { signal }); append(page.items); cursor = page.nextCursor; more.hidden = cursor === null; }
          catch (_) { if (!signal.aborted) g.toast(g.text("contentUnavailable")); }
          finally { more.disabled = false; }
        });
        root.append(more);
      }
      return root;
    }, () => this.open(filters));
  }
  show(raw) {
    const g = this.game, request = g.site.begin("restaurant");
    if (!request || !raw || typeof raw.title !== "string" || !Number.isSafeInteger(raw.id)) return;
    const l = this.data?.labels;
    if (!l) return this.open();
    this.seen.add(raw.id);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value);
    const item = { ...raw, audio: g.api.url(raw.audio), name: raw.author?.name || raw.author?.handle || "" };
    g.site.current = { group: "restaurant", item };
    const root = activity(g, "restaurant", item.title);
    root.append(el("p", { text: item.name, class: "world-experience-byline" }), el("h2", { text: l.ingredients }));
    const list = el("ul", { class:"world-recipe-ingredients" });
    for (const ingredient of item.ingredients || []) {
      const name = this.data.ingredients.find(d => d.id === ingredient.id)?.name || ingredient.id;
      const unit = this.data.units.find(u => u.id === ingredient.unit)?.label || ingredient.unit;
      const quantity = new Intl.NumberFormat(g.config.locale, { maximumFractionDigits: 2 }).format(ingredient.quantity);
      list.append(el("li", { text: `${quantity} ${unit} · ${name}` }));
    }
    root.append(list);
    if (item.audio) {
      const play = button(l.listen, () => g.media.start(item, true), "world-primary");
      play.dataset.worldPlay = ""; root.append(play);
    }
    if (item.instructions) root.append(el("h2", { text: l.preparation }), el("p", { class: "world-recipe-instructions", text: item.instructions }));
    root.append(ratingView(g, item), button(l.another, () => this.next()), button(l.title, () => this.open()));
    g.site.mount(root, request);
  }
  next() {
    const g = this.game;
    return g.site.load("restaurant", g.text("restaurant"), async signal => {
      this.queue = this.queue.filter(row => !this.seen.has(row.id));
      if (!this.queue.length) {
        this.data = await g.api.request("recipes", {mode:"discover",round:this.round++,exclude:[...this.seen].join(",")},{signal});
        this.queue = this.data.items;
      }
      if (signal.aborted) return;
      if (this.queue.length) { this.show(this.queue.shift()); return; }
      const l=this.data.labels, root=activity(g,"restaurant",l.title);
      root.append(el("p",{text:g.text("noResults")}),button(l.title,()=>this.open()));
      return root;
    },()=>this.next());
  }
  async compose() {
    const g = this.game, l = this.data.labels;
    if (!(await g.materials.ready())) return g.self.explain(g.session.get() ? "communitySyncNeeded" : "communityNeedsAccount");
    const request = g.site.begin("restaurant");
    if (!request) return;
    if (this.publication && this.publication.owner !== g.materials.owner) {
      this.publication = null; this.draft = null;
    }
    const draft = this.draft ||= { operationId: operationId(), lang: g.config.locale, title: "", instructions: "", ingredients: [], audio: null };
    const root = activity(g, "restaurant", l.publish), form = el("form", { class: "world-recipe-form" });
    const field = (label, node) => el("label", { class: "world-recipe-field" }, [el("span", { text: label }), node]);
    const title = el("input", { value: draft.title, minlength: 3, maxlength: this.data.limits.title, required: "" });
    const instructions = el("textarea", { rows: 6, maxlength: this.data.limits.instructions, placeholder: l.textHint, text: draft.instructions });
    title.oninput = () => { draft.title = title.value; draft.operationId = operationId(); };
    instructions.oninput = () => { draft.instructions = instructions.value; draft.operationId = operationId(); };
    const lang = el("select", {}, LANGUAGES.map(value => el("option", { value, text: languageName(value) })));
    lang.value = draft.lang;
    lang.onchange = () => { draft.lang = lang.value; draft.operationId = operationId(); };
    form.append(field(l.dish,title),field(l.language,lang),el("h2",{text:l.ingredients}));
    for (const definition of this.data.ingredients) {
      const existing = draft.ingredients.find(i => i.id === definition.id);
      const check = el("input", { type:"checkbox", "aria-label":definition.name }); check.checked = !!existing;
      const count = el("input", { type:"number", min:0.01, max:100000, step:"any", value:existing?.quantity || 1, "aria-label":l.quantity });
      const units = el("select", { "aria-label":l.unit }, this.data.units.map(unit => el("option", { value:unit.id, text:unit.label })));
      units.value = existing?.unit || "unit";
      const update = () => {
        draft.ingredients = draft.ingredients.filter(i => i.id !== definition.id);
        if (check.checked) draft.ingredients.push({ id:definition.id, quantity:Number(count.value), unit:units.value });
        draft.operationId = operationId();
      };
      check.onchange = count.oninput = units.onchange = update;
      form.append(el("div", { class:"world-recipe-ingredient" }, [field(definition.name,check),count,units]));
    }
    form.append(field(l.preparation,instructions));
    const status = el("p", { role:"status", "aria-live":"polite" });
    const record = button(l.record, async () => {
      if (this.recording) { this.stopRecording(); return; }
      let stream;
      record.disabled = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio:true });
        if (request.signal.aborted) { stream.getTracks().forEach(t=>t.stop()); return; }
        g.media.stop(); g.narrating(true);
        const recorder = new MediaRecorder(stream), chunks = [];
        this.recording = { recorder, stream, startedAt: performance.now(), timer: setTimeout(()=>this.stopRecording(), this.data.limits.audioSeconds[1]*1000) };
        const startedAt = this.recording.startedAt;
        let bytes = 0;
        recorder.ondataavailable = event => { chunks.push(event.data); bytes += event.data.size; if (bytes > this.data.limits.audioBytes) this.stopRecording(); };
        recorder.onstop = () => {
          stream.getTracks().forEach(t=>t.stop()); g.narrating(false);
          const tooShort = performance.now() - startedAt < this.data.limits.audioSeconds[0] * 1000;
          draft.audio = tooShort ? null : new Blob(chunks, { type:recorder.mimeType }); draft.operationId = operationId();
          if (!request.signal.aborted) {
            record.textContent = l.record; preview(); send.disabled = false;
            if (tooShort) status.textContent = l.audioDuration;
          }
        };
        recorder.onerror = () => { this.stopRecording(); status.textContent = l.error; };
        recorder.start(1000); record.textContent = l.stop; send.disabled = true;
      } catch (_) { stream?.getTracks().forEach(t=>t.stop()); g.narrating(false); status.textContent = l.error; }
      finally { record.disabled = false; }
    });
    const remove = button(l.removeAudio, () => { draft.audio = null; draft.operationId = operationId(); preview(); });
    const audio = el("audio", { controls:"", preload:"metadata" });
    let blobUrl = null;
    const preview = () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = draft.audio ? URL.createObjectURL(draft.audio) : null;
      audio.hidden = remove.hidden = !blobUrl;
      if (blobUrl) audio.src = blobUrl; else audio.removeAttribute("src");
    };
    audio.onplay = () => { g.media.stop(); g.narrating(true); };
    audio.onpause = audio.onended = () => g.narrating(false);
    request.signal.addEventListener("abort", () => { this.stopRecording(); audio.pause(); if (blobUrl) URL.revokeObjectURL(blobUrl); }, { once:true });
    record.disabled = !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined";
    const send = el("button", { type:"submit", text:l.send, class:"world-primary" });
    preview();
    form.append(el("p",{text:l.audioHint}),record,audio,remove,status,send);
    const freeze = locked => {
      for (const field of form.querySelectorAll("input,textarea,select,button"))
        if (field !== send) field.disabled = locked;
      if (!locked) record.disabled = !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined";
    };
    freeze(!!this.publication);
    form.onsubmit = async event => {
      event.preventDefault(); if (send.disabled) return;
      if (!draft.ingredients.length || (!draft.audio && !draft.instructions.trim())) { status.textContent = l.textHint; return; }
      send.disabled = true; send.textContent = l.sending;
      const { audio:recording, ...payload } = draft;
      this.publication ||= { owner:g.materials.owner, payload:JSON.parse(JSON.stringify(payload)), audio:recording };
      const publication = this.publication;
      freeze(true);
      try {
        const publish = token => g.api.request("recipe-publish", { ...publication.payload, ...(token ? {turnstile_token:token} : {}) },
          { auth:true, audio:publication.audio, timeout:90000 });
        let result;
        try { result = await publish(); }
        catch (error) {
          if (error.code !== "turnstile_required") throw error;
          result = await publish(await g.proof.request());
        }
        this.draft = null; this.publication = null;
        if (!request.signal.aborted) { g.toast(l.saved); this.show(result.recipe); }
      } catch (error) {
        // A lost acknowledgement must resend the SAME publication, not turn an edit into a second recipe.
        if (error.status >= 400 && error.status < 500 && error.status !== 429) this.publication = null;
        status.textContent = ({ ingredients_required:l.missing, too_many:l.tooMany, invalid_audio_duration:l.audioDuration })[error.code] || l.error;
        freeze(!!this.publication);
      }
      finally { send.disabled = false; send.textContent = l.send; }
    };
    root.append(form); g.site.mount(root,request);
  }
  stopRecording() {
    const active = this.recording; if (!active) return;
    this.recording = null; clearTimeout(active.timer);
    if (active.recorder.state !== "inactive") active.recorder.stop();
    active.stream.getTracks().forEach(track=>track.stop());
  }
}
module.exports = { Restaurant };

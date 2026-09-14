(() => {
  const VERSION = '0.1.1';
  if (globalThis.__autumnFormEngine?.version === VERSION) return;
  const elements = new Map();
  const compact = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_*:：()（）\-./[\]0-9]/g, '');
  const optionText = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const CONTROL = 'input:not([type=hidden]),textarea,select,[contenteditable=true],[role=combobox]';
  const SELECT = '.ant-select,.el-select,.MuiAutocomplete-root,.MuiSelect-root,[role=combobox],[aria-haspopup=listbox]';
  const LABEL = 'label,.field-label,.form-label,.ant-form-item-label,.el-form-item__label,[data-label],[class*=fieldLabel],[class*=item-label]';
  const POPUP = '[role=listbox],.ant-select-dropdown,.el-select-dropdown,.MuiPopover-root';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function visible(element) {
    if (!element?.isConnected || !element.getClientRects().length || element.closest('[inert],[aria-hidden=true]')) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return true;
  }
  function roots(root = document) {
    return [root, ...[...root.querySelectorAll('*')].flatMap(element => element.shadowRoot ? roots(element.shadowRoot) : [])];
  }
  function text(element) {
    if (!element) return '';
    const copy = element.cloneNode(true);
    for (const child of copy.querySelectorAll('input,textarea,select,[role=combobox],[role=listbox],script,style,[aria-hidden=true],.help,.error,.ant-form-item-explain')) child.remove();
    return copy.textContent.trim().replace(/\s+/g, ' ');
  }
  function ids(element, attribute) {
    return (element?.getAttribute(attribute) || '').split(/\s+/).map(id => element.getRootNode().getElementById?.(id)?.textContent || '').join(' ').trim();
  }
  function sectionOf(value) {
    if (/教育|学历|学业|academic|education/i.test(value)) return 'education';
    if (/项目|project/i.test(value)) return 'projects';
    if (/工作经历|实习经历|工作经验|任职|employment|experience|work history/i.test(value)) return 'experiences';
    if (/基本信息|个人信息|联系方式|personal|contact|basic information/i.test(value)) return 'identity';
    if (/自我评价|自我介绍|技能|语言|证书|奖项|summary|skills|certificates/i.test(value)) return 'profile';
    if (/求职偏好|意向|preferences/i.test(value)) return 'preferences';
    return '';
  }
  function labelOf(element, radio = false) {
    const explicit = ids(element, 'aria-labelledby') || element.getAttribute('aria-label');
    if (explicit) return explicit.slice(0, 200);
    if (!radio) {
      const own = [...(element.labels || [])].map(label => text(label)).join(' ') || text(element.closest('label'));
      if (own) return own.slice(0, 200);
      const input = element.querySelector?.('input');
      const linked = input ? ids(input, 'aria-labelledby') || input.getAttribute('aria-label') || [...(input.labels || [])].map(label => text(label)).join(' ') : '';
      if (linked) return linked.slice(0, 200);
    }
    let branch = element;
    for (let parent = element.parentElement, depth = 0; parent && depth < 6; branch = parent, parent = parent.parentElement, depth++) {
      const controls = [...parent.querySelectorAll(CONTROL)].filter(control => !control.closest(POPUP));
      if (controls.length > (radio ? 8 : 3)) break;
      const preceding = candidate => !!(candidate.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING);
      const candidates = [...parent.querySelectorAll(LABEL)].filter(candidate => !candidate.querySelector(CONTROL) && !candidate.closest(POPUP) && text(candidate).length <= 100);
      const label = candidates.find(candidate => preceding(candidate)) || candidates.find(candidate => candidate.parentElement === parent);
      if (label && text(label)) return text(label).slice(0, 200);
      const sibling = [...parent.children].find(candidate => candidate !== branch && preceding(candidate) && !candidate.querySelector(CONTROL) && !candidate.matches('input,select,textarea,button,h1,h2,h3,h4,legend,[role=heading]') && !candidate.closest(POPUP) && text(candidate) && text(candidate).length <= 60);
      if (sibling) return text(sibling).slice(0, 200);
      if (parent.matches('fieldset,[role=radiogroup]')) return text(parent.querySelector('legend')) || ids(parent, 'aria-labelledby') || parent.getAttribute('aria-label') || '';
    }
    const input = element.matches('input,textarea') ? element : element.querySelector('input');
    const placeholder = input?.getAttribute('placeholder') || '';
    return /^(请输入|请选择|please (?:enter|select)|select|choose)\s*[.。…]*$/i.test(placeholder) ? '' : placeholder;
  }
  function contextOf(element) {
    let branch = element;
    for (let parent = element.parentElement, depth = 0; parent && depth < 12; branch = parent, parent = parent.parentElement, depth++) {
      const aria = parent.getAttribute('aria-label') || ids(parent, 'aria-labelledby');
      if (sectionOf(aria)) return aria.slice(0, 160);
      const headings = [...parent.children].filter(child => child.matches('legend,h2,h3,h4,[role=heading]'));
      const preceding = headings.filter(heading => !!(heading.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (preceding.length && (sectionOf(text(preceding.at(-1))) || preceding.at(-1).matches('h2,legend'))) return text(preceding.at(-1)).slice(0, 160);
      if (parent.matches('fieldset,[role=group],[role=tabpanel]') && headings.length === 1) return text(headings[0]).slice(0, 160);
    }
    return '';
  }
  function recordRoot(element, section) {
    if (!['education', 'experiences', 'projects'].includes(section)) return null;
    for (let parent = element.parentElement, depth = 0; parent && depth < 7; parent = parent.parentElement, depth++) {
      if (/(?:education|experience|employment|project)[-_ ]?(?:item|row|entry|card|block)/i.test(parent.className || '') || parent.hasAttribute('data-record-index')) return parent;
      const siblings = [...(parent.parentElement?.children || [])].filter(sibling => sibling.tagName === parent.tagName && sibling.className === parent.className && sibling.querySelectorAll(CONTROL).length >= 2);
      if (parent.querySelectorAll(CONTROL).length >= 2 && siblings.length > 1 && !parent.querySelector('h2,h3,legend')) return parent;
      if (parent.matches('fieldset,form')) break;
    }
    return null;
  }
  function kindOf(element) {
    if (element.matches('select')) return 'select';
    if (element.matches('input[type=radio],[role=radiogroup]')) return 'radio';
    if (element.matches(SELECT)) return 'combobox';
    if (element.readOnly && (element.closest('.ant-picker,.el-date-editor,.react-datepicker-wrapper') || /date|calendar|日期|时间|年月|yyyy/i.test((element.className || '') + ' ' + element.placeholder + ' ' + element.name))) return 'date-picker';
    return element.type || (element.isContentEditable ? 'contenteditable' : 'text');
  }
  function readValue(saved) {
    const { element, type, members = [] } = saved;
    if (type === 'radio') return members.find(member => member.checked || member.getAttribute('aria-checked') === 'true')?.value || '';
    if (type !== 'combobox') return String(element.value ?? (element.isContentEditable ? element.textContent : '') ?? '');
    const selected = element.querySelector('.ant-select-selection-item,.el-select__selected-item:not(.is-transparent),.MuiSelect-select,[data-selected-value]');
    if (selected && !selected.matches('[class*=placeholder]')) return selected.textContent.trim();
    const input = element.matches('input') ? element : element.querySelector('input:not([type=hidden])');
    if (input?.value) return input.value;
    if (element.getAttribute('aria-placeholder') || element.querySelector('[class*=placeholder],.is-transparent')) return '';
    const value = element.matches('input') ? '' : text(element);
    return /^(请选择.*|please select.*|select|choose)$/i.test(value) ? '' : value;
  }
  function scan() {
    elements.clear();
    if (!window.innerWidth || !window.innerHeight || (window.frameElement && !visible(window.frameElement))) return [];
    const fields = [], seen = new Set(), occurrences = new Map(), records = new Map();
    for (const root of roots()) {
      for (const candidate of root.querySelectorAll(`${CONTROL},${SELECT},[role=radiogroup]`)) {
        if (candidate.closest(POPUP)) continue;
        let element = candidate.matches('select') ? candidate : candidate.matches('input,textarea') ? candidate.parentElement?.closest(SELECT) || candidate : candidate.closest(SELECT) || candidate;
        if (element.closest('[role=radiogroup]')) element = element.closest('[role=radiogroup]');
        if (seen.has(element)) continue;
        seen.add(element);
        if (!visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true' || element.matches('button') && element.type !== 'button') continue;
        const type = kindOf(element);
        if (['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image', 'checkbox'].includes(type) || element.readOnly && !['combobox', 'date-picker'].includes(type)) continue;
        if (/^(?:pri)?(?:photo|avatar|portrait|attachment|resume).*url$/i.test(element.name || '')) continue;
        const members = type === 'radio' ? (element.matches('[role=radiogroup]') ? [...element.querySelectorAll('input[type=radio]')] : [...root.querySelectorAll('input[type=radio]')].filter(member => member.name && member.name === element.name && member.form === element.form)) : [];
        if (type === 'radio') { if (!members.length) continue; for (const member of members) seen.add(member); }
        const label = labelOf(element, type === 'radio'), context = contextOf(element), section = sectionOf(context);
        const input = element.matches('input,textarea,select') ? element : element.querySelector('input');
        const name = element.name || input?.name || input?.id || element.id || '';
        const group = `${section || compact(context)}:${compact(label || name)}`;
        const occurrence = occurrences.get(group) || 0; occurrences.set(group, occurrence + 1);
        const record = recordRoot(element, section);
        if (record && !records.has(section)) records.set(section, []);
        const sectionRecords = records.get(section) || [];
        if (record && !sectionRecords.includes(record)) sectionRecords.push(record);
        const recordIndex = record ? sectionRecords.indexOf(record) : occurrence;
        const fingerprint = `${compact(context)}|${compact(name)}|${compact(label)}|${type}|${occurrence}`;
        const id = `field-${fields.length}`;
        const saved = { element, type, members, fingerprint };
        elements.set(id, saved);
        fields.push({ id, fingerprint, label, context, section, name, type, recordIndex, autocomplete: input?.autocomplete?.split(' ').at(-1) || '', placeholder: input?.placeholder || '', value: readValue(saved), maxLength: input?.maxLength > 0 ? input.maxLength : null, options: type === 'select' ? [...element.options].filter(option => !option.disabled).map(option => ({ label: option.text, value: option.value })) : type === 'radio' ? members.map(member => ({ label: [...(member.labels || [])].map(label => text(label)).join(' ') || member.getAttribute('aria-label') || member.value, value: member.value })) : [], unsupported: type === 'date-picker' ? '只读日期控件需在网页选择；不会伪造写入结果' : '' });
      }
    }
    return fields;
  }
  function equivalent(value, key) {
    const normalized = optionText(value);
    if (/education\.\d+\.degree$/.test(key || '')) {
      if (/^(master(?:'s)?(?:degree)?|msc|ma|硕士|硕士研究生|研究生)$/.test(normalized)) return 'master';
      if (/^(bachelor(?:'s)?(?:degree)?|bsc|ba|本科|学士|大学本科)$/.test(normalized)) return 'bachelor';
      if (/^(phd|doctor(?:ate)?|博士|博士研究生)$/.test(normalized)) return 'doctor';
    }
    if (key === 'identity.gender') {
      if (/^(male|man|男|男性)$/.test(normalized)) return 'male';
      if (/^(female|woman|女|女性)$/.test(normalized)) return 'female';
    }
    return normalized;
  }
  function setValue(element, value, blur = true) {
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    element.focus();
    if (element.isContentEditable) element.textContent = value;
    else if (descriptor?.set) descriptor.set.call(element, value);
    else throw new Error('此控件需要在网页填写');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: value }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    if (blur) element.blur();
  }
  function click(element) {
    if (element.matches('button') && element.type !== 'button') throw new Error('不会点击可能提交表单的按钮');
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, buttons: 1 }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, button: 0 }));
    element.click();
  }
  async function choose(saved, value, key) {
    const element = saved.element;
    const previous = new Set([...document.querySelectorAll(POPUP)].filter(popup => visible(popup)));
    click(element.querySelector('.ant-select-selector,.el-select__wrapper,.el-input__inner,.MuiSelect-select,.MuiAutocomplete-popupIndicator') || element);
    const input = element.matches('input') ? element : element.querySelector('input');
    const popupScope = () => {
      const owners = [element, input, ...element.querySelectorAll('[aria-controls],[aria-owns]')].filter(Boolean);
      const linked = owners.flatMap(owner => [owner.getAttribute('aria-controls'), owner.getAttribute('aria-owns')].filter(Boolean).flatMap(ids => ids.split(/\s+/).map(id => owner.getRootNode().getElementById?.(id)).filter(Boolean))).find(popup => visible(popup));
      if (linked) return linked;
      const opened = [...document.querySelectorAll(POPUP)].filter(popup => visible(popup) && !previous.has(popup));
      return opened.length === 1 ? opened[0] : null;
    };
    let options = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const scope = popupScope();
      options = scope ? [...scope.querySelectorAll('[role=option],.ant-select-item-option,.el-select-dropdown__item,.MuiMenuItem-root')].filter(option => visible(option) && option.getAttribute('aria-disabled') !== 'true' && !option.matches('[class*=disabled]')) : [];
      if (options.length) break;
      await pause(50);
    }
    const matching = () => options.filter(option => equivalent(option.querySelector('.ant-select-item-option-content')?.textContent || option.getAttribute('aria-label') || option.textContent, key) === equivalent(value, key));
    let matches = matching();
    if (!matches.length && input && !input.readOnly) {
      setValue(input, value, false);
      await pause(200);
      const scope = popupScope();
      options = scope ? [...scope.querySelectorAll('[role=option],.ant-select-item-option,.el-select-dropdown__item')].filter(option => visible(option) && option.getAttribute('aria-disabled') !== 'true') : [];
      matches = matching();
    }
    if (matches.length !== 1) {
      if (input && !input.readOnly) setValue(input, '', false);
      throw new Error('下拉选项无法唯一确认，请在网页选择');
    }
    // option handlers are scoped to this opened list; never click arbitrary
    // text-matched buttons elsewhere on the page.
    click(matches[0]);
    await pause(100);
    if (equivalent(readValue(saved), key) !== equivalent(value, key)) throw new Error('下拉未保留选中结果，请检查网页');
  }
  async function fill(payload) {
    const old = new Map(elements), fresh = scan(), results = [];
    for (const field of payload.fields) {
      const current = fresh.find(item => item.fingerprint === field.fingerprint.replace(/^\d+:/, ''));
      const saved = current && elements.get(current.id), element = saved?.element;
      let status;
      if (!saved || element !== old.get(field.id)?.element || !visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true') status = '页面字段已变化，请重新识别';
      else if (!payload.overwrite && readValue(saved).trim()) status = '保留已有内容';
      else if (!field.value?.trim()) status = '无资料，留空';
      else if (current.unsupported) status = current.unsupported;
      else if (current.maxLength && field.value.length > current.maxLength) status = `超过 ${current.maxLength} 字限制，未截断，请手动调整`;
      else try {
        if (saved.type === 'combobox') await choose(saved, field.value, field.factKey);
        else if (saved.type === 'radio') {
          const matching = saved.members.filter(member => !member.disabled && equivalent([...member.labels].map(label => text(label)).join(' ') || member.value, field.factKey) === equivalent(field.value, field.factKey));
          if (matching.length !== 1) throw new Error('单选选项无法唯一确认，请在网页选择');
          matching[0].click();
          await pause(50);
          if (!matching[0].checked) throw new Error('网页没有保留单选结果');
        } else {
          let value = field.value;
          if (saved.type === 'select') {
            const matching = [...element.options].filter(option => !option.disabled && option.value && equivalent(option.text, field.factKey) === equivalent(value, field.factKey));
            if (matching.length !== 1) throw new Error('选项无法精确对应，请手动选择');
            value = matching[0].value;
          }
          setValue(element, value);
          await pause(80);
          if (!element.isConnected || readValue(saved) !== value) throw new Error('网页没有保留填写结果，请检查');
        }
        status = '已填写';
      } catch (error) { status = error.message; }
      results.push({ id: field.id, frameId: field.frameId, label: field.label || field.name, status });
    }
    return results;
  }
  globalThis.__autumnFormEngine = { version: VERSION, run(command, payload) {
    if (command === 'scan') return scan();
    if (command === 'fill') return fill(payload);
    if (command === 'capture') return { title: document.title, text: (getSelection()?.toString().trim() || document.querySelector('main,article,[role=main]')?.innerText || document.body.innerText).slice(0, 40_000) };
    throw new Error('未知页面操作');
  } };
})();

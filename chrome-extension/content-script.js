(() => {
  if (globalThis.__autumnApplyController) return;
  const elements = new Map();
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_*:：()（）\-./[\]0-9]/g, '');
  // Option values are facts, not field identifiers: digits and punctuation
  // distinguish Level 1/2, .NET/NET, dates and school names.
  const normalizeOption = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const visible = element => element.isConnected && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert],[aria-hidden="true"]');
  function roots(root = document) {
    const result = [root];
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) result.push(...roots(element.shadowRoot));
    return result;
  }
  function textOfIds(element, attribute) {
    return (element.getAttribute(attribute) || '').split(/\s+/).map(id => element.getRootNode().getElementById?.(id)?.textContent || '').join(' ').trim();
  }
  function labelOf(element) {
    const labelText = label => {
      if (!label) return '';
      const copy = label.cloneNode(true);
      for (const control of copy.querySelectorAll('input,select,textarea,[role=combobox],script,style')) control.remove();
      return copy.textContent;
    };
    const explicit = textOfIds(element, 'aria-labelledby') || element.getAttribute('aria-label') || [...(element.labels || [])].map(item => labelText(item)).join(' ') || labelText(element.closest('label'));
    if (explicit?.trim()) return explicit.trim().slice(0, 200);
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
      const labels = [...parent.querySelectorAll('label,.form-label,.ant-form-item-label,.el-form-item__label,[data-label]')];
      const label = labels.find(item => !item.querySelector('input,select,textarea') && item.textContent?.trim());
      if (label && parent.querySelectorAll('input:not([type=hidden]),select,textarea,[role=combobox]').length <= 2) return label.textContent.trim().slice(0, 200);
    }
    return element.getAttribute('placeholder') || element.getAttribute('name') || element.id || '';
  }
  function contextOf(element) {
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 9; depth++, parent = parent.parentElement) {
      const heading = parent.querySelector(':scope > legend,:scope > h2,:scope > h3,:scope > h4,:scope > [role=heading]') || (parent.matches('fieldset,[role=group],[role=tabpanel]') ? parent.querySelector('legend,h2,h3,h4,[role=heading]') : null);
      const text = heading?.textContent || parent.getAttribute('aria-label') || textOfIds(parent, 'aria-labelledby');
      if (text?.trim() && /education|academic|experience|employment|work history|project|教育|学校|学历|工作经历|实习经历|工作经验|项目|任职/i.test(text)) return text.trim().slice(0, 160);
    }
    // Common forms use a preceding section heading rather than a fieldset.
    let sibling = element.parentElement;
    for (let depth = 0; sibling && depth < 5; depth++, sibling = sibling.parentElement) {
      for (let previous = sibling.previousElementSibling, count = 0; previous && count < 6; previous = previous.previousElementSibling, count++) {
        if (previous.matches('h2,h3,h4,[role=heading]')) return previous.textContent.trim().slice(0, 160);
      }
    }
    return '';
  }
  function scan() {
    elements.clear();
    const fields = [], occurrences = new Map();
    for (const root of roots()) {
      for (const element of root.querySelectorAll('input,textarea,select,[contenteditable="true"],[role="combobox"]')) {
        if (!visible(element) || element.disabled || element.readOnly || element.getAttribute('aria-disabled') === 'true') continue;
        const type = element.type || (element.isContentEditable ? 'contenteditable' : 'combobox');
        if (['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(type)) continue;
        // A custom wrapper around a real input must not be filled twice.
        if (element.getAttribute('role') === 'combobox' && !element.matches('input,textarea,select') && element.querySelector('input,select,textarea')) continue;
        const label = labelOf(element), context = contextOf(element), name = element.name || element.id || '';
        const groupKey = `${normalize(context)}:${normalize(label)}`;
        const recordIndex = occurrences.get(groupKey) || 0;
        occurrences.set(groupKey, recordIndex + 1);
        const fingerprint = `${normalize(context)}|${normalize(name)}|${normalize(label)}|${type}|${recordIndex}`;
        const id = `field-${fields.length}`;
        elements.set(id, { element, fingerprint });
        fields.push({ id, fingerprint, label, context, name, type, recordIndex, autocomplete: element.autocomplete || '', placeholder: element.getAttribute('placeholder') || '', value: element.value ?? element.textContent ?? '', maxLength: element.maxLength > 0 ? element.maxLength : null, options: element.matches('select') ? [...element.options].filter(option => !option.disabled).map(option => ({ label: option.text, value: option.value })) : [] });
      }
    }
    return fields;
  }
  function setValue(element, value) {
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (element.isContentEditable) element.textContent = value;
    else if (descriptor?.set) descriptor.set.call(element, value);
    else throw new Error('这个控件需要手动填写');
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
  async function fill(payload) {
    const results = [];
    // Save old references, then recompute descriptors. A rerender or changed
    // label cannot redirect a previously approved value into a different field.
    const old = new Map(elements), fresh = scan();
    for (const field of payload.fields) {
      const saved = old.get(field.id);
      const current = fresh.find(item => item.fingerprint === field.fingerprint.replace(/^\d+:/, ''));
      const element = current ? elements.get(current.id)?.element : null;
      let status = '';
      if (!element || element !== saved?.element || !visible(element) || element.disabled || element.readOnly) status = '页面字段已变化，请重新识别';
      else if (!payload.overwrite && String(element.value ?? element.textContent ?? '').trim()) status = '保留已有内容';
      else if (!field.value?.trim()) status = '无资料，留空';
      else if (current.maxLength && field.value.length > current.maxLength) status = `超过 ${current.maxLength} 字限制，未截断，请手动调整`;
      else {
        try {
          let value = field.value;
          if (element.matches('select')) {
            const options = [...element.options].filter(option => !option.disabled && option.value && normalizeOption(option.text) === normalizeOption(value));
            if (options.length !== 1) throw new Error('选项无法精确对应，请手动选择');
            value = options[0].value;
          }
          if (element.getAttribute('role') === 'combobox' && !element.matches('select')) {
            if (!element.matches('input')) throw new Error('自定义下拉框，请手动选择后重新识别');
            element.focus();
            setValue(element, value);
            await new Promise(resolve => setTimeout(resolve, 250));
            const controls = element.getAttribute('aria-controls');
            const scope = controls ? element.getRootNode().getElementById?.(controls) : null;
            const options = scope ? [...scope.querySelectorAll('[role=option]')].filter(option => visible(option) && normalizeOption(option.textContent) === normalizeOption(value)) : [];
            if (options.length !== 1) { setValue(element, ''); throw new Error('自定义选项未确认，请手动选择'); }
            options[0].click();
          } else setValue(element, value);
          await new Promise(resolve => setTimeout(resolve, 30));
          if (!element.isConnected || String(element.value ?? element.textContent ?? '') !== value) throw new Error('页面未保留填写结果，请检查');
          status = '已填写';
        } catch (error) { status = error.message; }
      }
      results.push({ id: field.id, frameId: field.frameId, label: field.label, status });
    }
    return results;
  }
  globalThis.__autumnApplyController = { run(command, payload) {
    if (command === 'scan') return scan();
    if (command === 'fill') return fill(payload);
    if (command === 'capture') return { title: document.title, text: (getSelection()?.toString().trim() || document.querySelector('main,article,[role=main]')?.innerText || document.body.innerText).slice(0, 40_000) };
    throw new Error('未知页面操作');
  } };
})();

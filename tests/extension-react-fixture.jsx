import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

// This intentionally models third-party non-native dropdown markup; native
// select/option elements would not exercise the failing production control.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

function Select({ label, id, choices, value, onChange }) {
  const [open, setOpen] = useState(false);
  return <div className="form-row"><div className="field-label">* {label}：</div><div className="ant-select" role="presentation" onMouseDown={() => setOpen(true)}>
    <div className="ant-select-selector"><input id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} readOnly value="" /><span className={value ? 'ant-select-selection-item' : 'ant-select-selection-placeholder'}>{value || '请选择'}</span></div>
    {open && <div role="listbox" id={`${id}-list`}>{choices.map(choice => <div key={choice} role="option" tabIndex={0} aria-selected={value === choice} onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); onChange(choice); setOpen(false); } }} onClick={event => { event.stopPropagation(); onChange(choice); setOpen(false); }}>{choice}</div>)}</div>}
  </div></div>;
}
function App() {
  const [values, setValues] = useState({ name: '', phone: '', email: '', school0: '', school1: '', degree: '', gender: '' });
  const [renders, setRenders] = useState(0);
  const update = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const input = (key, label, index = '') => <div className="form-row"><div className="field-label">* {label}：</div><div className="field-content"><input name={index || key} placeholder="请输入" value={values[key]} onChange={event => update(key, event.target.value)} /></div></div>;
  return <form onSubmit={event => { event.preventDefault(); window.submitted = true; }}>
    <h2>基本信息</h2><input name="priPhotoUrl" style={{ opacity: 0, width: 1, height: 1, position: 'absolute' }} />
    {input('name', '姓名')}{input('phone', '手机号码')}{input('email', '电子邮箱')}
    <div className="form-row"><div className="field-label">性别：</div><div>{['男', '女'].map(gender => <label key={gender}><input type="radio" name="gender" value={gender} checked={values.gender === gender} onChange={() => update('gender', gender)} />{gender}</label>)}</div></div>
    <h2>教育经历</h2><div className="education-item">{input('school0', '学校名称', 'education[0].school')}</div><div className="education-item">{input('school1', '学校名称', 'education[1].school')}</div>
    <Select label="学历" id="degree" choices={['本科', '硕士', '博士']} value={values.degree} onChange={value => update('degree', value)} />
    <button type="button" id="rerender" onClick={() => setRenders(count => count + 1)}>重新渲染</button><button type="submit">保存并提交</button>
    <label><input type="checkbox" name="consent" />同意隐私政策</label>
    <output id="framework-state">{JSON.stringify({ ...values, renders })}</output>
  </form>;
}
createRoot(document.getElementById('root')).render(<App />);

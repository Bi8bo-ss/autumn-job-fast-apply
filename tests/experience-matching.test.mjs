import assert from 'node:assert/strict';
import test from 'node:test';
import { matchExperienceFacts } from '../lib/experience-matching.ts';

await test('selects only the strongest facts from each experience and keeps the source unchanged', () => {
  const profile = {
    experiences: [{
      organization: '星河科技',
      title: '数据分析实习生',
      highlights: [
        '使用 SQL 分析用户行为并定位增长异常',
        '搭建核心指标体系与监控看板，支持团队决策',
        '使用 Python 完成 A/B Test 并输出结论',
        '优化数据清洗流程，缩短分析准备时间',
        '分析用户留存变化并提出增长建议',
        '研究竞品功能与用户反馈，整理产品建议',
        '整理供应商合同与会议纪要',
        '组织团队团建活动',
        '维护办公用品采购清单',
        '协助安排访客接待',
      ],
    }],
  };
  const original = structuredClone(profile);
  const matches = matchExperienceFacts(profile, '负责用户行为与增长数据分析，搭建指标体系，开展 A/B Test，使用 SQL、Python，并优化数据清洗流程', 5);

  assert.deepEqual(profile, original);
  assert.equal(matches.length, 5);
  assert.deepEqual(matches.map((item) => item.fact).sort(), [
    '使用 Python 完成 A/B Test 并输出结论',
    '使用 SQL 分析用户行为并定位增长异常',
    '优化数据清洗流程，缩短分析准备时间',
    '搭建核心指标体系与监控看板，支持团队决策',
    '分析用户留存变化并提出增长建议',
  ].sort());
});

await test('does not force unrelated facts into a job match', () => {
  const matches = matchExperienceFacts({ experiences: [{ organization: '', title: '', highlights: ['整理供应商合同', '组织团队团建活动'] }] }, '负责用户增长数据分析与 SQL 看板', 5);
  assert.equal(matches.length, 0);
});

await test('keeps a multiline fact as one selectable fact', () => {
  const fact = '使用 SQL 搭建增长漏斗周报\n推动 3 项改进，转化率提升 12%';
  const matches = matchExperienceFacts({ experiences: [{ organization: '测试科技', title: '数据实习生', highlights: [fact] }] }, '负责使用 SQL 进行增长漏斗分析并提升转化率', 5);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].fact, fact);
});

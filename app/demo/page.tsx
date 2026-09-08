import type { Metadata } from 'next';
import { DemoWorkspace } from '@/components/demo-workspace';

export const metadata: Metadata = {
  title: '产品演示 · 秋招速投',
  description: '体验从岗位 JD 到定向简历、填写材料和投递跟踪的完整流程。',
};

export default function DemoPage() {
  return <DemoWorkspace />;
}

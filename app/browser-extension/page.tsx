import { AppShell } from '@/components/app-shell';
import { AppLink } from '@/components/app-link';
import { requirePageUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function BrowserExtensionPage() {
  await requirePageUser('/browser-extension');
  return <AppShell title="Chrome 浏览器插件" description="采集岗位，复用真实档案填写网申；提交始终由你完成。">
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="workspace-panel p-6">
        <h2 className="text-lg font-semibold">秋招速投 · 岗位采集与网申填写</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">先在个人档案保存一次教育、工作、项目和常用问答。打开招聘页面的插件，采集截图与 JD；打开网申页面，按字段含义匹配档案，检查后填写。不确定或没有资料的字段留空，默认不覆盖你已经填写的内容。</p>
        <a href="/browser-extension.zip" download className="mt-5 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white">下载 Chrome 插件</a>
        <AppLink href="/profile" className="ml-4 text-sm text-primary">维护个人档案</AppLink>
      </section>
      <section className="workspace-panel p-6 text-sm leading-7">
        <h2 className="text-base font-semibold">安装与使用</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>解压下载的文件，打开 Chrome 扩展程序页面（chrome://extensions），开启开发者模式，点击“加载已解压的扩展程序”，选择解压目录。</li>
          <li>保持本网站已登录的标签页打开。点击插件图标，选择“同步资料”，需要岗位文案时选择相应岗位。</li>
          <li>在招聘页面采集截图和正文，预览后选择 AI 提取，检查公司与 JD 并保存。截图只有在你点击提取后才发送给网站 AI。</li>
          <li>在网申页面点击识别字段，检查对应关系，再点击填写。不确定的字段可手动指定资料来源，并自动在本机记住。</li>
          <li>进入下一页或手动新增教育 / 经历行后重新识别。嵌入表单如需额外权限，在插件中仅授权该表单域名。</li>
        </ol>
      </section>
      <section className="workspace-panel p-6 text-sm leading-7 text-muted-foreground">
        <h2 className="font-semibold text-foreground">通用性与当前边界</h2>
        <p className="mt-2">支持中英文字段、普通输入框、文本域、原生下拉、日期、已有的多条教育 / 经历、开放 Shadow DOM，以及获得权限的 iframe。采用语义匹配与网站专属修正，不依赖某家公司固定的页面布局。</p>
        <p className="mt-2">复杂联动下拉、封闭 Shadow DOM、文件上传、单选 / 复选、验证码和最终提交仍由你处理。插件不会为了填满表单编造资料，也不会自动新增行或翻页。此版本并不承诺所有网站都能一键完成；无法确认的控件会明确提示。</p>
      </section>
    </div>
  </AppShell>;
}

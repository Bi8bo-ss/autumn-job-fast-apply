/**
 * 简历证件照只放在部署者本地，不进入代码仓库。
 *
 * 把照片保存为 public/resume-portrait.local.jpg（已在 .gitignore 中忽略），
 * 本地构建和部署时会随静态资源一起发布；仓库克隆者没有这个文件时，
 * 预览、HTML/PDF 导出和 DOCX 导出都会自动省略照片位。
 */
export const RESUME_PORTRAIT_PATH = '/resume-portrait.local.jpg';

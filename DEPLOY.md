# 部署指引 v2 · NucMed DB 静态站（2026-10-28）

> v1（GitHub Pages 方案）已作废：`github.com` 在本机**完全连不上**（实测 6 秒超时）。
> 归档在 `DEPLOY_v1_github_void.md`。

## §0 ★ 实测可达性（本机真实网络，非猜测）

| 目标 | 结果 | 判定 |
|---|---|---|
| `github.com` | **超时 6012 ms** | ❌ 注册/推送都做不了 |
| `gitee.com` | 200 · 207 ms | ✅ |
| `vercel.com`（控制台） | 200 · 377 ms | ✅ |
| **`*.vercel.app`（部署域名）** | **超时 8012 ms** | ❌ **部署了也没人打得开** |
| `pages.cloudflare.com` | 200 · **4923 ms** | ⚠️ 慢 |
| `dash.cloudflare.com/sign-up` | **超时 8014 ms** | ❌ 注册页打不开 |
| **`app.netlify.com/drop`** | **200 · 270 ms** | ✅ **快** |
| **`app.netlify.com/signup`** | **200 · 241 ms** | ✅ **快** |
| **`*.netlify.app`（部署域名）** | **404 · 552 ms** | ✅ **能连通** |
| `*.pages.dev`（部署域名） | 268 ms | ✅ |
| `*.github.io`（部署域名） | 404 · 557 ms | ✅（但推不上去） |
| `cloud.tencent.com` | 200 · 184 ms | ✅ |
| `oss.console.aliyun.com` | 200 · 238 ms | ✅ |

### ★ 结论：**Netlify 是唯一「控制台 + 部署域名」双通的平台**

- GitHub：控制台不通 ⇒ 死路
- Vercel：控制台通，但 `*.vercel.app` 8 秒超时 ⇒ 导师打不开 ⇒ 死路
- Cloudflare：注册页超时 ⇒ 死路（域名本身是通的，但进不去后台）
- **Netlify：270 ms / 241 ms / 552 ms，全通** ✅
- 腾讯云 COS：通，但需实名 + 域名备案（**长期最稳的国内方案**，见 §3）

## §1 已备好的产物（不用再构建）

| 文件 | 大小 | 说明 |
|---|---|---|
| `D:\nucmed\web\dist\` | 70.9 MB · 3,948 文件 | 完整站点 |
| **`D:\nucmed\logs\pk261_main\nucmed-dist.zip`** | **56.1 MB** | 供拖拽上传 |
| `dist/_redirects` | 4 行 | **SPA 回退**（否则 `/drug/322` 404） |
| `dist/404.html` | 933 B | 备用回退 |
| `dist/index.html` | 0.89 KB | 资源路径为 `/assets/...`（根路径部署，Netlify 直接可用） |

## §2 ★ 方案 A · Netlify Drop（推荐 · 不用注册就能先看到）

### 步骤（约 5 分钟）

1. 浏览器打开 **<https://app.netlify.com/drop>**（实测 270 ms）
2. 把 **`D:\nucmed\logs\pk261_main\nucmed-dist.zip`** 拖进虚线框
   —— **拖 zip，不要拖 dist 文件夹**（3,948 个小文件逐个传会很慢）
3. 等它传完（56 MB，取决于上行带宽，约 2–10 分钟）
4. 会得到一个随机地址，形如 `https://spontaneous-xxx-123456.netlify.app`
5. **立刻点这个地址验证**（见 §4 四条）
6. 想长期保留 + 改名：页面会提示 **Sign up**，用**邮箱**注册即可（不需要 GitHub / 不需要信用卡）
7. 注册后在 **Site settings → Change site name** 把名字改成 `nucmed`

### 之后每次更新数据

```powershell
cd D:\nucmed
D:\conda_envs\nucmed312\python.exe web\scripts\export_data.py    # 重导数据
cd web
npm run build                                                     # 自动带 _redirects / 404.html
Compress-Archive -Path 'dist\*' -DestinationPath 'D:\nucmed\logs\pk261_main\nucmed-dist.zip' -Force
# 再拖一次 zip 到 app.netlify.com/drop → 会问是否覆盖，选 Deploy
```

> 也可用 CLI（可自动化、增量上传）：
> ```powershell
> cd D:\nucmed\web
> npx netlify-cli login          # 浏览器授权
> npx netlify-cli deploy --prod --dir=dist
> ```

## §2.5 方案 B · Cloudflare Pages（域名更快，但注册页本机打不开）

若你换个网络能进 `dash.cloudflare.com`：
1. Workers & Pages → Create → Pages → **Upload assets**
2. 把 `nucmed-dist.zip` 拖进去
3. 得到 `https://<project>.pages.dev`（实测 **268 ms**，比 Netlify 快一倍）
4. `_redirects` 已支持，无需额外配置

## §3 方案 C · 腾讯云 COS（国内最稳 · 长期方案）

**什么时候上**：导师反馈 Netlify 打开慢，或要正式对外发布时。

1. 控制台建存储桶（地域**上海/广州**，权限**公有读私有写**）
2. 基础配置 → 静态网站 → 开启；默认首页 `index.html`，**错误文档也填 `index.html`**
3. 上传 `dist/` **里面的内容**（不要连 dist 文件夹本身）到桶根
4. 用桶的默认域名访问

**两个坑**：
- COS 默认域名对新桶会强制 `Content-Disposition: attachment`（点了是下载不是打开）⇒ 需绑定自定义域名
- 自定义域名需 **ICP 备案**（约 1–3 周）

## §4 ★ 上线后必验 4 条（别看首页就当成了）

| # | 验什么 | 期望 |
|---|---|---|
| 1 | **直接粘** `<域名>/drug/322`（不要从首页点进去） | 能出页面 ← 验 `_redirects` 生效 |
| 2 | 详情页滚到「完整结构图」 | **有图**，不是虚线框 ← 验 base 路径 |
| 3 | 首页右上 | 有数据 **861** · 目录 **5,159** · 剂量学 **403** |
| 4 | F12 切 375px | 无横向滚动条 |

## §5 常见失败与处置

| 现象 | 原因 | 处置 |
|---|---|---|
| 白屏，控制台 404 `/assets/*.js` | 部署路径不是根 | Netlify 部署到根域，`base` 应为 `/`；若用子路径要设 `VITE_BASE` 重新 build |
| 首页正常，`/drug/322` 404 | `_redirects` 没上传 | 确认 zip 里有 `_redirects`（`dist/_redirects` 4 行） |
| 结构图全是虚线框 | zip 打漏了 `struct/` | zip 应是 `dist\*`（不是 `dist` 文件夹本身），解压后根目录直接有 `index.html` |
| 上传卡在 0% | 拖的是文件夹不是 zip | 改拖 `nucmed-dist.zip` |
| 打开很久白屏 | 首屏要下 1.65 MB `drugs.json` | 属正常，见 §6 第 3 条 |

## §6 已知限制（提前跟导师说明，别让他当成 bug）

1. **「性质与证据」不能按药过滤** —— `property_evidence.subject_key` 是「核素\|药名片段」，映射不到 `drug_id`（数据层限制）
2. **只有 35 个药有剂量学**（403 行），其余药该 Tab 灰态属正常
3. **首屏要下 1.65 MB `drugs.json`** —— 4G 下 2–4 s，之后走浏览器缓存
4. 药目录 5,159 个里**只有 861 个有生物分布数据**，页面按「有数据 / 目录」双口径显示
5. Gitee 仓库仍是**主代码库**（`gitee.com/mengcity1/nucmed`）；GitHub 镜像暂不可用

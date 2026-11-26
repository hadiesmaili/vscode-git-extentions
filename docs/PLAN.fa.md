# Git Workspace — تحلیل، فیدبک و پلن پروژه

> افزونه مدرن مدیریت Git برای VS Code
> هدف: کاربر برای کارهای روزمره Git دیگر ترمینال باز نکند.

---

## ۱. جمع‌بندی کلی

پیشنهادها در مجموع **درست و هم‌جهت** هستند. معماری Extension Host + React Webview، گراف SVG اختصاصی و استفاده هم‌زمان از Git API و Git CLI انتخاب‌های صحیحی‌اند. بیشتر ریسک پروژه در **سه جا** است، نه در انتخاب Stack:

1. **الگوریتم Layout گراف** و عملکرد آن روی تاریخچه‌های بزرگ.
2. **هماهنگی با تم‌های VS Code** (طرح مرجع کاملاً سفارشی است و با تم کاربر تضاد دارد).
3. **محدوده (Scope)**: فهرست امکانات برای یک نفر خیلی بزرگ است و باید سخت‌گیرانه مرحله‌بندی شود.

---

## ۲. تحلیل تصویر مرجع

| بخش تصویر | نظر |
| --- | --- |
| Git Graph با خطوط رنگی منحنی و Label شاخه‌ها | هسته هویت بصری. خوب است. خطوط منحنی (Bezier) را حفظ کن. |
| Sidebar با Working Tree، Changes، Staged | خوب، ولی با Source Control داخلی VS Code هم‌پوشانی دارد (پایین‌تر بحث شده). |
| Commit Details با آواتار | آواتار نیاز به شبکه (Gravatar/GitHub) دارد. پیش‌فرض: حروف اول نام با رنگ ثابت؛ آواتار آنلاین اختیاری در تنظیمات. |
| Diff Viewer سفارشی | ساخت Diff Viewer کامل پرهزینه است. VS Code خودش Diff Editor عالی دارد. |
| نوار Activity Bar سفارشی و دکمه‌های پنجره macOS | این‌ها در Webview ممکن نیست و نباید ساخته شوند؛ فقط حالت نمایشی دارند. |
| پس‌زمینه گرادیان و Glassmorphism | در Webview داخل ادیتور غیرضروری است و با تم کاربر ناهماهنگ می‌شود. حداقل استفاده. |

**ایرادهای جزئی تصویر:** شماره خط ۲۷ تکراری است؛ Diff خطوط Context کافی ندارد. در پیاده‌سازی واقعی دقت شود.

---

## ۳. فیدبک روی پیشنهادها

### موافقم ✅

- **TypeScript strict + VS Code API + React + Vite.** Next.js لازم نیست.
- **گراف با SVG اختصاصی، نه React Flow.**
- **Git CLI با `execFile` و آرگومان جدا**، نه رشته Shell.
- **پوشه `shared` برای Typeها و قرارداد پیام‌ها.**
- **Virtualization** (TanStack Virtual).
- **CSP سخت‌گیرانه** و اعتبارسنجی پیام‌ها.
- **تأیید کاربر برای عملیات مخرب** (Reset hard، Force Push، Discard، حذف Branch).
- **جدا بودن گراف از پنل Source Control.**
- **اول Graph و Source Control، بعد بقیه.**

### نقد و اصلاح ⚠️

**۱. Diff Viewer اختصاصی را در MVP نساز.**
VS Code دستور `vscode.diff` دارد که Syntax Highlight، Inline/Side-by-side، ناوبری و Collapse را رایگان می‌دهد. با یک `TextDocumentContentProvider` (اسکیم مثل `gitws:`) محتوای فایل در هر Commit را به آن بده. Diff Viewer داخل Webview را بعداً فقط برای «پیش‌نمایش سریع» در Commit Details بساز.

**۲. Sidebar را دوباره نساز، یا خیلی سبک بساز.**
Source Control داخلی VS Code از قبل Stage/Unstage/Commit/Discard دارد و کاربران به آن عادت دارند. دو گزینه:
- **گزینه پیشنهادی:** Sidebar به‌صورت `WebviewView` در Activity Bar خود افزونه، ولی کوچک و سریع؛ تمرکز روی چیزی که SCM داخلی ندارد (وضعیت Sync، Branch سریع، ورود به گراف).
- Stage/Commit را در MVP داشته باش، ولی انتظار نداشته باش جای SCM داخلی را بگیرد.

**۳. تم: «رنگ سفارشی» در برابر «تم VS Code».**
طرح مرجع رنگ‌های ثابت Graphite/Indigo دارد. اگر کاربر تم Light یا Solarized داشته باشد، افزونه جدا و ناهماهنگ دیده می‌شود. راه‌حل:
- توکن‌های خودت را روی متغیرهای `--vscode-*` بنا کن (مثلاً `--surface: var(--vscode-editor-background)`).
- فقط **رنگ Accent و رنگ Laneهای گراف** مستقل باشند.
- یک تنظیم `gitWorkspace.theme: "auto" | "brand"` بده تا حالت «Premium» تصویر هم موجود باشد.
- High Contrast را فراموش نکن.

**۴. Tailwind v4 در Webview.**
مشکلی ندارد، ولی کلاس‌ها باید به CSS Variable وصل شوند نه رنگ ثابت. `@theme` در v4 برای این مناسب است. CSS Modules هم کافی است؛ یکی را انتخاب کن و ترکیب نکن. **پیشنهاد: Tailwind v4.**

**۵. Radix UI و Zustand.**
- Radix: برای Dropdown، Context Menu، Dialog و Tooltip عالی است (Accessibility آماده). نگه دار.
- Zustand: کافی و سبک. نگه دار.
- Codicons را به Lucide ترجیح بده یا فقط یکی را انتخاب کن. Codicons با VS Code یکپارچه‌تر است. **پیشنهاد: Codicons برای اکشن‌ها، چند آیکون Lucide فقط در صورت نیاز.**

**۶. Git API در برابر CLI.**
Git API داخلی (`vscode.git`) پایدار نیست و نسخه‌بندی ضعیفی دارد. فقط برای **تشخیص Repository و رویداد تغییر** (`onDidChangeState`) استفاده کن. همه خواندن‌ها و عملیات را با CLI انجام بده تا یک منبع حقیقت داشته باشی. اگر افزونه `vscode.git` غیرفعال بود، با `FileSystemWatcher` روی `.git` fallback داشته باش.

**۷. Zoom و Drag در گراف.**
گراف Git یک لیست عمودی است، نه بوم آزاد. Drag/Pan آزاد تجربه را بدتر می‌کند. به‌جایش: اسکرول عمودی مجازی + تنظیم **تراکم ردیف** (Compact / Comfortable) + اسکرول افقی وقتی Laneها زیادند.

**۸. انیمیشن‌ها.**
فقط Transition کوتاه (۱۲۰–۱۸۰ms) برای Hover و انتخاب. `prefers-reduced-motion` رعایت شود.

**۹. React 19 در Webview.**
مشکلی ندارد. فقط Bundle را کوچک نگه دار (هدف: زیر ~۳۰۰KB gzip).

**۱۰. pnpm و Packaging.**
`vsce` با pnpm مشکلات شناخته‌شده دارد. افزونه را با **esbuild** باندل کن (Extension Host) تا `node_modules` در VSIX نرود؛ سپس `vsce package --no-dependencies`.

---

## ۴. معماری نهایی

```
┌──────────────────────── Extension Host (Node) ────────────────────────┐
│ extension.ts → commands, providers                                    │
│ GitService ── execFile("git", args) ── Parser (log/status/diff/show)  │
│ RepoWatcher ── vscode.git API events + FS watcher                     │
│ Content Provider (gitws:) → vscode.diff                               │
│ Message Router ── validated, typed (zod / type guard)                 │
└───────────────────────────────▲───────────────────────────────────────┘
                                │ postMessage (Request/Response + Events)
┌───────────────────────────────▼───────────────────────────────────────┐
│ Webview: React + Zustand + Tailwind v4 + Radix                        │
│  ├─ Graph Panel (WebviewPanel, تمام‌صفحه در ادیتور)                    │
│  └─ Sidebar (WebviewView در Activity Bar)                             │
└───────────────────────────────────────────────────────────────────────┘
```

### قرارداد پیام

- الگوی **RPC**: هر درخواست `id` دارد و پاسخ با همان `id` برمی‌گردد (Promise در Webview).
- **Event**های Push از Host: `repoChanged`، `headChanged`، `operationProgress`.
- همه Typeها در `src/shared/messages`. پیام ورودی در Host با `zod` یا Type Guard اعتبارسنجی شود.

### داده گراف

- `git log --all --date-order --format=<custom with %x00>` با `--max-count` و صفحه‌بندی (مثلاً ۵۰۰ تایی).
- Layout Laneها در **Extension Host یا Web Worker**، نه در Render React.
- خروجی Layout: برای هر Commit → `lane`، `color`، و لیست Edgeها. Render فقط ردیف‌های قابل‌مشاهده.
- Refs از `git for-each-ref` جدا خوانده شوند.

---

## ۵. ساختار پوشه‌ها

```
git-workspace/
├── src/
│   ├── extension/
│   │   ├── extension.ts
│   │   ├── commands/
│   │   ├── git/            # git-client, parsers, history, branches, diff, status
│   │   ├── graph/          # layout algorithm (تست‌پذیر، بدون وابستگی به VS Code)
│   │   ├── providers/      # content provider, webview view provider
│   │   └── webview/        # panel, router, html + CSP
│   ├── webview/
│   │   ├── app/
│   │   ├── features/       # git-graph, source-control, commit-details, branches
│   │   ├── components/     # UI پایه (Button, Menu, Dialog, Tooltip)
│   │   ├── stores/
│   │   ├── lib/            # rpc client
│   │   └── styles/         # tokens.css, tailwind
│   └── shared/
│       ├── types/
│       └── messages/
├── test/
│   ├── fixtures/repos/     # اسکریپت ساخت Repoهای تستی پیچیده
│   └── unit/
├── esbuild.mjs
├── vite.config.ts
└── package.json
```

---

## ۶. Design Tokens (پیش‌نویس)

| توکن | Auto (از VS Code) | Brand (حالت تصویر) |
| --- | --- | --- |
| `--bg` | `--vscode-editor-background` | `#15161c` |
| `--surface` | `--vscode-sideBar-background` | `#1b1d25` |
| `--border` | `--vscode-panel-border` | `#2a2d3a` |
| `--text` | `--vscode-foreground` | `#e6e7ee` |
| `--text-muted` | `--vscode-descriptionForeground` | `#9095a8` |
| `--accent` | `#6d5dfc` (Indigo/Violet) | `#6d5dfc` |
| `--success` | `--vscode-gitDecoration-addedResourceForeground` | `#3ddc97` |
| `--warning` | `--vscode-gitDecoration-modifiedResourceForeground` | `#f5a524` |
| `--danger` | `--vscode-gitDecoration-deletedResourceForeground` | `#f25f5c` |

- **Radius:** ۶ (کنترل‌های کوچک)، ۱۰ (کارت/پنل)، ۱۴ (Dialog). ۱۶ برای کنترل‌های کوچک زیاد است.
- **Spacing:** مقیاس ۴px.
- **Font:** `--vscode-font-family` برای UI، `--vscode-editor-font-family` برای Hash و کد.
- **ارتفاع ردیف گراف:** ۲۸ (Compact) / ۳۶ (Comfortable).
- **رنگ Laneها:** پالت ۸ رنگی با کنتراست کافی در هر دو حالت روشن و تیره.

---

## ۷. پلن مرحله‌ای

### فاز ۰ — اسکلت (۱ هفته)
- `yo code` یا راه‌اندازی دستی؛ esbuild برای Host، Vite برای Webview.
- WebviewPanel با CSP و nonce، RPC تایپ‌شده، Hot Reload Webview.
- Tokens و چند کامپوننت پایه.
- **معیار پایان:** پیام رفت‌وبرگشت تایپ‌شده و تم Auto کار می‌کند.

### فاز ۱ — Git Graph (۲–۳ هفته) ⭐ هویت محصول
- GitService + Parser برای `log` و `for-each-ref`.
- الگوریتم Lane با Unit Test روی Repoهای Fixture (Merge، Octopus، شاخه‌های موازی).
- Render SVG مجازی، Label شاخه Local/Remote/Tag، HEAD.
- جستجو، فیلتر شاخه، انتخاب Commit، Load More.
- **معیار پایان:** Repo با ۵۰,۰۰۰ Commit (مثلاً خود `vscode`) روان اسکرول شود؛ بارگذاری اولیه زیر ۱ ثانیه.

### فاز ۲ — Commit Details + Diff (۱–۲ هفته)
- `git show --numstat`، لیست فایل‌ها، Parentها، کپی Hash.
- کلیک روی فایل → `vscode.diff` با Content Provider.
- **معیار پایان:** همه انواع تغییر (Add/Delete/Rename/Binary) درست نمایش داده شوند.

### فاز ۳ — Sidebar / Source Control (۱–۲ هفته)
- Status، Stage/Unstage/Discard، Commit و Amend، وضعیت Ahead/Behind.
- Fetch / Pull / Push با Progress.
- **معیار پایان:** چرخه کامل تغییر → Commit → Push بدون ترمینال.

### فاز ۴ — عملیات حرفه‌ای (۲–۳ هفته)
- Context Menu روی Commit و Branch: Checkout، Create/Rename/Delete Branch، Merge، Rebase، Cherry-pick، Revert، Reset (soft/mixed/hard)، Tag.
- Dialog تأیید برای عملیات مخرب؛ نمایش واضح Conflict و هدایت به Merge Editor داخلی VS Code.

### فاز ۵ — تکمیل (مستمر)
- فیلتر نویسنده/تاریخ، مقایسه دو Commit/Branch، چند Repository، Keyboard Shortcuts، ذخیره وضعیت (`getState`/`workspaceState`)، Stash، Accessibility (Screen reader و ناوبری کیبورد)، انتشار در Marketplace و Open VSX.

---

## ۸. ریسک‌ها

| ریسک | راه‌حل |
| --- | --- |
| کندی گراف در Repoهای بزرگ | صفحه‌بندی `git log`، Layout بیرون از React، Virtualization |
| ناهماهنگی با تم کاربر | توکن‌ها روی `--vscode-*`، حالت Brand اختیاری |
| Parse شکننده خروجی Git | فرمت سفارشی با جداکننده `%x00`، ثابت کردن `LC_ALL=C`، تست Fixture |
| Git در مسیرهای عجیب / Windows | گرفتن مسیر Git از تنظیم `git.path` و API داخلی |
| فشار Scope | معیار پایان مشخص برای هر فاز؛ فاز بعد فقط بعد از کامل شدن فاز قبل |
| عدم اجرای Git CLI در VS Code Web | فعلاً پشتیبانی نمی‌شود؛ در `package.json` فقط `main` (نه `browser`) |

---

## ۹. Stack نهایی

| بخش | انتخاب |
| --- | --- |
| Language | TypeScript (strict) |
| Extension Bundle | esbuild |
| UI | React 19 |
| Webview Build | Vite |
| Styling | Tailwind CSS v4 + CSS Variables |
| Components | Radix UI |
| Icons | Codicons (+ Lucide در صورت نیاز) |
| State | Zustand |
| Virtualization | TanStack Virtual |
| Validation پیام | zod |
| Git | Git CLI (منبع اصلی) + `vscode.git` API (کشف Repo و رویدادها) |
| Graph | SVG اختصاصی |
| Diff | `vscode.diff` داخلی (MVP) |
| Test | Vitest (Parser و Layout) + `@vscode/test-electron` |
| Package Manager | pnpm |

---

## ۱۰. تصمیم‌های باز

1. Sidebar کامل بسازیم یا نسخه سبک کنار SCM داخلی؟ (پیشنهاد: نسخه سبک)
2. حالت پیش‌فرض تم: `auto` یا `brand`؟ (پیشنهاد: `auto`)
3. آواتار آنلاین به‌صورت پیش‌فرض فعال باشد؟ (پیشنهاد: خیر، به دلیل حریم خصوصی)
4. نام نهایی و شناسه Publisher در Marketplace.

---

## ۱۱. آیا Go یا Rust پرفورمنس بهتری می‌دهد؟

**جواب کوتاه: نه به‌طور محسوس. TypeScript بماند.**

| موضوع | توضیح |
| --- | --- |
| Extension Host | فقط JavaScript/TypeScript اجرا می‌کند. VS Code API از Go یا Rust قابل دسترسی نیست. پس TS در هر حالت لازم است. |
| گلوگاه واقعی | زمان اجرای خود `git` (I/O دیسک) و Render در Webview. سرعت زبان Parser سهم کمی دارد. |
| Parse خروجی `git log` | با V8 برای ۵۰,۰۰۰ Commit در حد ده‌ها میلی‌ثانیه است. |
| Layout گراف | الگوریتم O(n × lanes) است؛ در TS هم سریع است. |
| هزینه Go/Rust | باینری جدا برای هر پلتفرم (win/mac/linux × x64/arm64)، VSIX چندپلتفرمی، امضای باینری در macOS، پیچیدگی Debug و ارتباط بین‌پروسه‌ای. |

**مسیر ارتقا در صورت نیاز (فقط بعد از Profiling):**
- **Rust → WebAssembly** برای Layout گراف. یک فایل `.wasm` روی همه پلتفرم‌ها کار می‌کند و مشکل باینری چندپلتفرمی ندارد.
- **Sidecar با `gitoxide` (Rust)** فقط اگر Repoهای خیلی بزرگ (مثل Monorepo با میلیون‌ها Commit) هدف باشند.

**قاعده:** اول TS. اگر اندازه‌گیری نشان داد Parse یا Layout بیش از ۱۰۰ms طول می‌کشد، همان بخش را به Rust/WASM منتقل کن.

---

## ۱۲. Inline Blame (نمایش کم‌رنگ نویسنده روی خط فعلی)

وقتی کاربر روی یک خط کلیک می‌کند یا Cursor روی آن می‌رود، انتهای خط به‌صورت کم‌رنگ نمایش داده شود:

```
const [isOpen, setIsOpen] = useState(true);     Hadi Esmaeili, 2 hours ago • feat: new UI
```

### پیاده‌سازی

- **رویداد:** `window.onDidChangeTextEditorSelection` با Debounce حدود ۱۵۰ms.
- **داده:** `git blame --porcelain --incremental -- <file>` برای کل فایل، یک بار، و Cache در حافظه بر اساس `path + HEAD`.
  - برای فایل ذخیره‌نشده: `git blame --contents -` و ارسال متن فعلی ادیتور از stdin تا شماره خطوط درست بماند.
- **نمایش:** `TextEditorDecorationType` با `after.contentText`:
  - رنگ: `new ThemeColor('editorCodeLens.foreground')` یا `editorGhostText.foreground` تا با هر تمی کم‌رنگ و هماهنگ باشد.
  - `fontStyle: 'italic'` و `margin: '0 0 0 3em'`.
  - فقط روی خط فعلی، نه همه خطوط.
- **Hover:** با `HoverProvider` روی همان خط، جزئیات کامل Commit نمایش داده شود: Hash، پیام کامل، تاریخ، و لینک «Open in Git Graph».
- **حالت‌های خاص:**
  - خط Commit‌نشده: `You • Uncommitted changes`.
  - فایل خارج از Repo، فایل Binary یا فایل بزرگ: نمایش داده نشود.
- **Invalidate Cache:** هنگام تغییر HEAD، ذخیره فایل یا رویداد Repository.

### تنظیمات

| تنظیم | پیش‌فرض |
| --- | --- |
| `gitWorkspace.inlineBlame.enabled` | `true` |
| `gitWorkspace.inlineBlame.format` | `${author}, ${timeAgo} • ${summary}` |
| `gitWorkspace.inlineBlame.delay` | `150` |

دستور Toggle در Command Palette هم اضافه شود.

**فاز:** در **فاز ۲** کنار Commit Details اضافه شود، چون همان سرویس `git show` را مصرف می‌کند.

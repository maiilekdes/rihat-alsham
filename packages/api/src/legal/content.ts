/**
 * Legal documents, bilingual, served as public HTML by routes/legal.ts.
 *
 * These live in the API rather than the app because the App Store requires a
 * publicly reachable privacy-policy URL at submission time, and because a
 * policy that ships inside a binary cannot be corrected without a new release.
 *
 * They describe what this system ACTUALLY does — the data inventory below was
 * taken from db/schema.sql and the payment/auth code, not from a template. If
 * you change what is collected, change this too.
 *
 * NOT LEGAL ADVICE. Saudi PDPL compliance, the CR/VAT details, and the
 * refund terms should be reviewed by a lawyer before launch. Every
 * BUSINESS_DETAILS field marked TODO must be filled in first — publishing
 * with placeholders is worse than publishing nothing.
 */

export const BUSINESS_DETAILS = {
  legalNameAr: 'مؤسسة ريحة الشام', // TODO: confirm the exact registered name
  legalNameEn: 'Rihat Alsham',
  crNumber: 'TODO_COMMERCIAL_REGISTRATION', // السجل التجاري
  vatNumber: 'TODO_VAT_NUMBER', // الرقم الضريبي — required on invoices at 15% VAT
  addressAr: 'المدينة المنورة - حي العريض، مقابل أسواق ومخابز السنابل',
  addressEn: 'Al-Areed District, opposite Sanabel Markets & Bakeries, Medina, Saudi Arabia',
  phone: '+966544066023',
  email: 'TODO_SUPPORT_EMAIL', // a real, monitored inbox — PDPL requires a contact route
  website: 'https://rihatalsham.com',
  lastUpdated: '2026-09-07',
};

/**
 * Do not expose draft legal pages containing placeholder business details.
 * The mobile app and App Store listing can point at these routes only after
 * every required value below has been replaced with a verified value.
 */
export const MISSING_BUSINESS_DETAILS = Object.entries(BUSINESS_DETAILS)
  .filter(([, value]) => !value || value.startsWith('TODO_'))
  .map(([key]) => key);

export const LEGAL_DOCUMENTS_READY = MISSING_BUSINESS_DETAILS.length === 0;

const B = BUSINESS_DETAILS;

export type LegalDoc = { slug: string; titleAr: string; titleEn: string; ar: string; en: string };

/** Everything this system stores about a customer. Keep in sync with db/schema.sql. */
const DATA_TABLE_AR = `
<table>
<tr><th>البيانات</th><th>سبب جمعها</th></tr>
<tr><td>رقم الجوال (مؤكَّد برمز)</td><td>إنشاء الحساب، تأكيد الطلب، تواصل السائق معك</td></tr>
<tr><td>الاسم (اختياري)</td><td>مخاطبتك في الطلب</td></tr>
<tr><td>البريد الإلكتروني</td><td>يُجمع فقط عند الدخول عبر Google أو Apple</td></tr>
<tr><td>عناوين التوصيل وإحداثياتها</td><td>إيصال الطلب إليك</td></tr>
<tr><td>سجل الطلبات والمشتريات</td><td>عرض طلباتك السابقة واحتساب نقاط الولاء</td></tr>
<tr><td>رسائل وصور محادثة الطلب</td><td>التواصل بينك وبين المطعم حول طلب محدد</td></tr>
<tr><td>رمز الإشعارات للجهاز</td><td>إرسال تحديثات حالة الطلب</td></tr>
<tr><td>آخر ٤ أرقام من البطاقة ونوعها</td><td>تمييز وسيلة الدفع في سجل الطلب</td></tr>
</table>`;

const DATA_TABLE_EN = `
<table>
<tr><th>Data</th><th>Why we collect it</th></tr>
<tr><td>Mobile number (verified by code)</td><td>Creating your account, confirming orders, letting the driver reach you</td></tr>
<tr><td>Name (optional)</td><td>Addressing you on your order</td></tr>
<tr><td>Email address</td><td>Collected only if you sign in with Google or Apple</td></tr>
<tr><td>Delivery addresses and their coordinates</td><td>Delivering your order</td></tr>
<tr><td>Order and purchase history</td><td>Showing past orders and calculating loyalty points</td></tr>
<tr><td>Order-chat messages and photos</td><td>Communication between you and the restaurant about a specific order</td></tr>
<tr><td>Device notification token</td><td>Sending order-status updates</td></tr>
<tr><td>Card last 4 digits and brand</td><td>Identifying the payment method on your order record</td></tr>
</table>`;

const privacy: LegalDoc = {
  slug: 'privacy',
  titleAr: 'سياسة الخصوصية',
  titleEn: 'Privacy Policy',
  ar: `
<p class="updated">آخر تحديث: ${B.lastUpdated}</p>

<p>يوضّح هذا المستند البيانات التي يجمعها تطبيق <strong>${B.legalNameEn} — ريحة الشام</strong>، ولماذا نجمعها، ومع من نشاركها، وكيف تتحكّم بها.</p>

<h2>١. البيانات التي نجمعها</h2>
${DATA_TABLE_AR}

<h2>٢. ما لا نجمعه</h2>
<ul>
<li><strong>لا نتتبّع سلوكك</strong>: لا يحتوي التطبيق على أي أدوات تتبّع أو تحليلات خارجية أو إعلانات.</li>
<li><strong>لا نصل إلى موقعك في الخلفية</strong>: يُطلب الموقع فقط عند إضافة عنوان توصيل، وبعد إذنك.</li>
<li><strong>لا نحفظ بيانات بطاقتك</strong>: تُدخل بيانات البطاقة مباشرة لدى مزوّد الدفع «مُيسّر»، ولا تمرّ عبر خوادمنا. نحفظ آخر أربعة أرقام ونوع البطاقة فقط.</li>
<li>لا نبيع بياناتك لأي جهة، ولا نستخدمها لأغراض تسويقية خارج التطبيق.</li>
</ul>

<h2>٣. الأساس النظامي للمعالجة</h2>
<p>نعالج بياناتك لتنفيذ العقد بيننا (تجهيز طلبك وتوصيله)، وللالتزام بالأنظمة المعمول بها في المملكة العربية السعودية (مثل حفظ الفواتير الضريبية)، ولمصلحة مشروعة محدودة في حماية النظام من إساءة الاستخدام.</p>

<h2>٤. الجهات التي نشارك معها</h2>
<ul>
<li><strong>Google Firebase</strong> — تأكيد رقم الجوال وتسجيل الدخول والإشعارات.</li>
<li><strong>مُيسّر (Moyasar)</strong> — معالجة المدفوعات؛ مزوّد سعودي مرخّص.</li>
<li><strong>Railway</strong> — استضافة الخوادم وقاعدة البيانات.</li>
<li><strong>Google reCAPTCHA</strong> — منع إساءة استخدام رسائل التحقق.</li>
</ul>
<p>لا نشارك بياناتك مع أي جهة أخرى إلا إذا طلبت ذلك جهة نظامية مختصة.</p>

<h2>٥. نقل البيانات خارج المملكة</h2>
<p>تُعالَج بعض البيانات على خوادم خارج المملكة العربية السعودية (هولندا، ومراكز بيانات Google). يجب توثيق المسوّغ والضمانات النظامية لكل عملية نقل وفق المادة ٢٩ من نظام حماية البيانات الشخصية ولائحة نقل البيانات قبل نشر هذه السياسة.</p>

<h2>٦. مدة الحفظ</h2>
<p>يُحتفظ بسجلات الطلبات والفواتير للمدة التي تفرضها الأنظمة الضريبية والتجارية. تُحذف بقية بياناتك عند حذف حسابك.</p>

<h2>٧. حقوقك</h2>
<p>وفقاً لنظام حماية البيانات الشخصية، لك الحق في الاطلاع على بياناتك، وتصحيحها، وطلب حذفها، والاعتراض على معالجتها.</p>
<p><strong>حذف الحساب:</strong> يمكنك حذف حسابك وبياناتك من داخل التطبيق: <em>حسابي ← حذف الحساب</em>. الحذف نهائي.</p>

<h2>٨. الأطفال</h2>
<p>التطبيق غير موجّه لمن هم دون سن ١٨ عاماً، ولا نجمع بياناتهم عن قصد.</p>

<h2>٩. التواصل معنا</h2>
<p>${B.legalNameAr}<br>${B.addressAr}<br>هاتف: ${B.phone}<br>بريد: ${B.email}<br>السجل التجاري: ${B.crNumber}</p>
`,
  en: `
<p class="updated">Last updated: ${B.lastUpdated}</p>

<p>This explains what the <strong>${B.legalNameEn}</strong> app collects, why, who we share it with, and how you control it.</p>

<h2>1. What we collect</h2>
${DATA_TABLE_EN}

<h2>2. What we do not collect</h2>
<ul>
<li><strong>We do not track your behaviour.</strong> The app contains no third-party analytics, advertising or tracking SDKs of any kind.</li>
<li><strong>No background location.</strong> Location is requested only when you add a delivery address, and only with your permission.</li>
<li><strong>We never hold your card details.</strong> Card data is entered directly with our payment provider, Moyasar, and does not pass through our servers. We keep only the last four digits and the card brand.</li>
<li>We do not sell your data, and we do not use it for marketing outside the app.</li>
</ul>

<h2>3. Legal basis</h2>
<p>We process your data to perform our contract with you (preparing and delivering your order), to comply with Saudi law (such as retaining tax invoices), and for a limited legitimate interest in protecting the service from abuse.</p>

<h2>4. Who we share it with</h2>
<ul>
<li><strong>Google Firebase</strong> — phone verification, sign-in, push notifications.</li>
<li><strong>Moyasar</strong> — payment processing; a licensed Saudi provider.</li>
<li><strong>Railway</strong> — server and database hosting.</li>
<li><strong>Google reCAPTCHA</strong> — preventing abuse of verification messages.</li>
</ul>
<p>We share your data with no one else unless a competent authority lawfully requires it.</p>

<h2>5. Transfers outside Saudi Arabia</h2>
<p>Some data is processed on servers outside the Kingdom (the Netherlands and Google data centres). The legal basis and safeguards for each transfer must be documented under Article 29 of the Personal Data Protection Law and its Transfer Regulation before this policy is published.</p>

<h2>6. Retention</h2>
<p>Order records and invoices are kept for the period required by Saudi tax and commercial law. The rest of your data is deleted when you delete your account.</p>

<h2>7. Your rights</h2>
<p>Under the Personal Data Protection Law you may access your data, correct it, request its deletion, and object to its processing.</p>
<p><strong>Account deletion:</strong> you can delete your account and data inside the app: <em>Profile → Delete account</em>. Deletion is permanent.</p>

<h2>8. Children</h2>
<p>This app is not directed at anyone under 18, and we do not knowingly collect their data.</p>

<h2>9. Contact</h2>
<p>${B.legalNameEn}<br>${B.addressEn}<br>Phone: ${B.phone}<br>Email: ${B.email}<br>Commercial Registration: ${B.crNumber}</p>
`,
};

const terms: LegalDoc = {
  slug: 'terms',
  titleAr: 'الشروط والأحكام',
  titleEn: 'Terms & Conditions',
  ar: `
<p class="updated">آخر تحديث: ${B.lastUpdated}</p>

<h2>١. من نحن</h2>
<p>${B.legalNameAr}، سجل تجاري ${B.crNumber}، ${B.addressAr}، هاتف ${B.phone}.</p>

<h2>٢. الطلبات</h2>
<p>يُعدّ الطلب مقبولاً عند تأكيد الدفع وظهوره لدى المطعم. نحتفظ بالحق في رفض أو إلغاء أي طلب مع ردّ كامل المبلغ إذا تعذّر تجهيزه (نفاد صنف، خارج نطاق التوصيل، أو خطأ ظاهر في السعر).</p>

<h2>٣. الأسعار</h2>
<p>جميع الأسعار بالريال السعودي وشاملة ضريبة القيمة المضافة (١٥٪) ما لم يُذكر خلاف ذلك. تُضاف رسوم التوصيل — إن وُجدت — قبل الدفع وتظهر بوضوح في صفحة الدفع.</p>

<h2>٤. الدفع</h2>
<p>تُعالَج المدفوعات عبر «مُيسّر». لا يصل الطلب إلى المطبخ قبل نجاح الدفع.</p>

<h2>٥. التوصيل</h2>
<p>أوقات التحضير والتوصيل تقديرية وليست ملزمة. يجب أن يكون العنوان ورقم الجوال صحيحين؛ لا نتحمّل مسؤولية تأخّر أو فشل التوصيل بسبب بيانات غير صحيحة.</p>

<h2>٦. نقاط الولاء</h2>
<p>تُحتسب النقاط على المبلغ المدفوع فعلياً، وليس لها قيمة نقدية، ولا يمكن تحويلها أو بيعها. نحتفظ بالحق في تعديل البرنامج أو إيقافه بإشعار مسبق.</p>

<h2>٧. سلوك المستخدم</h2>
<p>محادثة الطلب مخصّصة للتواصل حول الطلب فقط. يُمنع إرسال محتوى مسيء أو غير قانوني، ويجوز لنا تعليق الحساب عند إساءة الاستخدام.</p>

<h2>٨. الحساب</h2>
<p>أنت مسؤول عن الحفاظ على جهازك ورقم جوالك. يمكنك حذف حسابك في أي وقت من داخل التطبيق.</p>

<h2>٩. حدود المسؤولية</h2>
<p>مسؤوليتنا تقتصر على قيمة الطلب محل النزاع. لا يحدّ هذا من أي حقوق مقرّرة لك نظاماً.</p>

<h2>١٠. النظام الواجب التطبيق</h2>
<p>تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص الجهات القضائية السعودية بأي نزاع.</p>
`,
  en: `
<p class="updated">Last updated: ${B.lastUpdated}</p>

<h2>1. Who we are</h2>
<p>${B.legalNameEn}, Commercial Registration ${B.crNumber}, ${B.addressEn}, phone ${B.phone}.</p>

<h2>2. Orders</h2>
<p>An order is accepted once payment is confirmed and it appears at the restaurant. We may refuse or cancel an order with a full refund if we cannot fulfil it (an item is out of stock, the address is outside our delivery area, or there is an obvious pricing error).</p>

<h2>3. Prices</h2>
<p>All prices are in Saudi Riyals and include 15% VAT unless stated otherwise. Delivery fees, where they apply, are added and shown clearly before you pay.</p>

<h2>4. Payment</h2>
<p>Payments are processed by Moyasar. No order reaches the kitchen before payment succeeds.</p>

<h2>5. Delivery</h2>
<p>Preparation and delivery times are estimates, not guarantees. Your address and mobile number must be correct; we are not responsible for delays or failed delivery caused by incorrect details.</p>

<h2>6. Loyalty points</h2>
<p>Points are earned on the amount actually paid. They have no cash value and cannot be transferred or sold. We may change or end the programme with prior notice.</p>

<h2>7. Conduct</h2>
<p>The order chat is for communication about your order only. Abusive or unlawful content is prohibited and may result in suspension.</p>

<h2>8. Your account</h2>
<p>You are responsible for your device and mobile number. You may delete your account at any time from within the app.</p>

<h2>9. Limitation of liability</h2>
<p>Our liability is limited to the value of the order in dispute. This does not limit any rights granted to you by law.</p>

<h2>10. Governing law</h2>
<p>These terms are governed by the laws of the Kingdom of Saudi Arabia, and Saudi courts have jurisdiction over any dispute.</p>
`,
};

const refund: LegalDoc = {
  slug: 'refund',
  titleAr: 'سياسة الاسترجاع والإلغاء',
  titleEn: 'Refund & Cancellation Policy',
  ar: `
<p class="updated">آخر تحديث: ${B.lastUpdated}</p>

<p>الطعام سلعة قابلة للتلف، ولذلك لا ينطبق عليه حق العدول لمدة ثلاثة أيام المنصوص عليه في نظام التجارة الإلكترونية. تحلّ محلّه السياسة التالية.</p>

<h2>الإلغاء</h2>
<ul>
<li><strong>قبل بدء التحضير</strong> (بينما حالة الطلب «تم الاستلام»): يمكن الإلغاء مع ردّ كامل المبلغ.</li>
<li><strong>بعد بدء التحضير</strong>: لا يمكن الإلغاء، لأن الطعام يكون قد أُعدّ خصيصاً لطلبك.</li>
</ul>

<h2>متى نردّ المبلغ كاملاً</h2>
<ul>
<li>إذا ألغينا الطلب لأي سبب (نفاد صنف، أو تعذّر التوصيل).</li>
<li>إذا وصل الطلب ناقصاً أو خاطئاً.</li>
<li>إذا وصل الطعام بحالة غير صالحة.</li>
<li>إذا خُصم المبلغ ولم يصل الطلب.</li>
</ul>

<h2>كيف تطلب الاسترجاع</h2>
<p>تواصل معنا خلال <strong>٢٤ ساعة</strong> من استلام الطلب عبر محادثة الطلب داخل التطبيق، أو هاتفياً على ${B.phone}. قد نطلب صورة للطلب.</p>

<h2>مدة الاسترجاع</h2>
<p>يُعاد المبلغ إلى وسيلة الدفع نفسها. تستغرق البنوك عادةً من ٥ إلى ١٤ يوم عمل لإظهار المبلغ.</p>

<h2>نقاط الولاء</h2>
<p>عند استرجاع طلب، تُسحب النقاط المكتسبة منه، وتُعاد النقاط التي استُخدمت فيه.</p>
`,
  en: `
<p class="updated">Last updated: ${B.lastUpdated}</p>

<p>Food is a perishable good, so the three-day right of withdrawal in the Saudi E-Commerce Law does not apply to it. The following policy applies instead.</p>

<h2>Cancellation</h2>
<ul>
<li><strong>Before preparation starts</strong> (while the order status is "Received"): you can cancel for a full refund.</li>
<li><strong>After preparation starts</strong>: the order cannot be cancelled, because the food has been made specifically for you.</li>
</ul>

<h2>When we refund in full</h2>
<ul>
<li>If we cancel your order for any reason (an item is unavailable, or we cannot deliver).</li>
<li>If your order arrives incomplete or incorrect.</li>
<li>If the food arrives in unacceptable condition.</li>
<li>If you were charged but the order never arrived.</li>
</ul>

<h2>How to request a refund</h2>
<p>Contact us within <strong>24 hours</strong> of receiving your order, through the in-app order chat or by phone on ${B.phone}. We may ask for a photo of the order.</p>

<h2>Timing</h2>
<p>Refunds go back to the original payment method. Banks typically take 5–14 business days to show the amount.</p>

<h2>Loyalty points</h2>
<p>When an order is refunded, points earned on it are reversed and any points spent on it are returned.</p>
`,
};

const cookies: LegalDoc = {
  slug: 'cookies',
  titleAr: 'سياسة ملفات الارتباط',
  titleEn: 'Cookie Policy',
  ar: `
<p class="updated">آخر تحديث: ${B.lastUpdated}</p>

<h2>تطبيق الجوال</h2>
<p><strong>لا يستخدم تطبيق الجوال ملفات ارتباط (Cookies) ولا أي أدوات تتبّع.</strong> يحفظ التطبيق جلسة الدخول على جهازك فقط حتى لا تضطر لتسجيل الدخول في كل مرة، ولا تُقرأ هذه البيانات من قِبلنا ولا من طرف ثالث.</p>

<h2>لوحة تحكم الموظفين</h2>
<p>لوحة التحكم مخصّصة لموظفي المطعم فقط وليست موجّهة للعملاء. تستخدم تخزيناً محلياً <strong>ضرورياً فقط</strong> للحفاظ على جلسة تسجيل الدخول. لا توجد ملفات ارتباط للتحليلات أو التسويق أو التتبّع.</p>

<h2>لماذا لا يوجد إشعار موافقة؟</h2>
<p>لأن ما نستخدمه ضروري لتشغيل الخدمة التي طلبتها صراحةً (البقاء مسجّلاً في حسابك)، ولا نستخدم أي ملفات ارتباط اختيارية أو تتبّعية تتطلّب موافقة مسبقة.</p>

<h2>reCAPTCHA</h2>
<p>عند التحقق من رقم جوالك تُستخدم خدمة Google reCAPTCHA لمنع إساءة الاستخدام، وقد تضع Google ملفات خاصة بها لهذا الغرض. تخضع لسياسة خصوصية Google.</p>
`,
  en: `
<p class="updated">Last updated: ${B.lastUpdated}</p>

<h2>Mobile app</h2>
<p><strong>The mobile app uses no cookies and no tracking technologies.</strong> It stores your sign-in session on your own device so you don't have to log in every time. That data is never read by us or by any third party.</p>

<h2>Staff dashboard</h2>
<p>The dashboard is for restaurant staff only and is not customer-facing. It uses <strong>strictly necessary</strong> local storage to keep you signed in. There are no analytics, marketing or tracking cookies.</p>

<h2>Why there is no consent banner</h2>
<p>Because what we use is strictly necessary to deliver a service you explicitly asked for (staying signed in to your account). We use no optional or tracking cookies that would require prior consent.</p>

<h2>reCAPTCHA</h2>
<p>When verifying your mobile number we use Google reCAPTCHA to prevent abuse, and Google may set its own cookies for that purpose. This is governed by Google's privacy policy.</p>
`,
};

export const LEGAL_DOCS: LegalDoc[] = [privacy, terms, refund, cookies];
export const findDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);

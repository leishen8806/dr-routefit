// Design copy only; Khmer wording requires native-speaker review before release.
export const locales=['km-KH','en-US','zh-CN'];
export const languageNames={'km-KH':'ខ្មែរ','en-US':'English','zh-CN':'中文'};
const rows={
 language:['ភាសា','Language','语言'],
 title:['ការរចនាពហុភាសា','Multilingual design','多语言设计'],
 draft:['គំរូរចនា · ទិន្នន័យសាកល្បង · មិនបញ្ជូនការងារពិត','Design preview · synthetic data · no live dispatch','设计预览 · 合成数据 · 不执行真实派单'],
 review:['អត្ថបទខ្មែរត្រូវការការពិនិត្យដោយអ្នកនិយាយភាសាខ្មែរជាភាសាកំណើត។','Khmer copy needs native-speaker review.','高棉文案待母语人员复核。'],
 dispatch:['មជ្ឈមណ្ឌលបញ្ជូនការងារ','Dispatch centre','调度中心'],
 driver:['ការបញ្ជាទិញរបស់ខ្ញុំ','My orders','司机订单'],
 import:['នាំចូលការបញ្ជាទិញ','Import orders','外部订单导入'],
 fees:['ថ្លៃសេវា និងការទូទាត់','Fees & settlement','费用与结算'],
 pending:['រង់ចាំការបញ្ជូន','Awaiting dispatch','待派单'],
 transit:['កំពុងដឹកជញ្ជូន','In delivery','配送中'],
 overdue:['ហួសពេលកំណត់','Overdue','已超时'],
 completed:['បានបញ្ចប់','Completed','已完成'],
 cancelled:['បានលុបចោល','Cancelled','已取消'],
 location:['ទីតាំងយានយន្ត','Vehicle location','车辆位置'],
 stale:['ទីតាំងចាស់ · ត្រូវផ្ទៀងផ្ទាត់','Stale location · verify first','位置已过期 · 待核实'],
 map:['ផែនទីបង្ហាញគំរូប៉ុណ្ណោះ','Schematic map only','地图仅为示意'],
 verify:['ផ្ទៀងផ្ទាត់ទីតាំងមុនពេលបញ្ជូនការងារ។','Verify the vehicle location before dispatching.','派单前先核实车辆位置。'],
 order:['លេខការបញ្ជាទិញ','Order ID','订单编号'],
 pickup:['អាសយដ្ឋានទៅយកទំនិញ','Pickup address','上门收货地址'],
 pickupContact:['អ្នកទំនាក់ទំនងនៅកន្លែងយកទំនិញ','Pickup contact','取件联系人'],
 pickupPhone:['លេខទូរសព្ទកន្លែងយកទំនិញ','Pickup phone','取件联系电话'],
 destination:['អាសយដ្ឋានដឹកជញ្ជូន','Delivery address','送货地址'],
 recipient:['អ្នកទទួល','Recipient','收货人'],
 phone:['លេខទូរសព្ទអ្នកទទួល','Recipient phone','收货联系电话'],
 deliveryFee:['ថ្លៃដឹកជញ្ជូន','Delivery fee','配送费'],
 insurance:['ថ្លៃធានារ៉ាប់រងការដឹកជញ្ជូន','Delivery insurance fee','配送保险费'],
 total:['សរុបត្រូវបង់','Total payable','客户应付合计'],
 platform:['ចំណែករបស់វេទិកា','Platform share','平台分成'],
 driverShare:['ប្រាក់ចំណូលអ្នកបើកបរ','Driver earnings','司机收入'],
 insuranceNote:['ថ្លៃធានារ៉ាប់រងកត់ត្រាដាច់ដោយឡែក មិនរួមក្នុងការបែងចែកថ្លៃដឹកជញ្ជូនទេ។','Insurance is recorded separately and excluded from delivery-fee sharing.','保险费单独记账，不参与配送费分成。'],
 quote:['តម្លៃប៉ាន់ស្មានប៉ុណ្ណោះ · មិនមែនជាភស្តុតាងធានារ៉ាប់រង','Quote only · not proof of insurance cover','仅为报价 · 不代表保险已生效'],
 ratio:['ឧទាហរណ៍ចំណែកវេទិកា៖ 20%','Example platform share: 20%','演示平台比例：20%'],
 original:['អាសយដ្ឋាន ឈ្មោះ និងលេខទូរសព្ទរក្សាតាមអត្ថបទដើម។','Addresses, names and phone numbers stay in their original form.','地址、姓名与电话保留原文，不自动翻译。'],
 save:['រក្សាទុកសេចក្ដីព្រាង','Save draft','保存草稿'],
 saved:['បានរក្សាទុកសេចក្ដីព្រាងនៅក្នុងការមើលជាមុននេះ។','Draft saved in this preview session.','草稿已保存在此预览会话中。'],
 storageError:['មិនអាចរក្សាទុកបានទេ។ សូមកុំបិទទំព័រនេះ។','Storage unavailable. Keep this page open.','本机存储不可用，请保留当前页面。'],
 required:['សូមបំពេញព័ត៌មានទំនាក់ទំនង និងអាសយដ្ឋានទាំងអស់។','Complete every address and contact field.','请填写完整的地址和联系方式。'],
 empty:['មិនមានការបញ្ជាទិញក្នុងក្រុមនេះទេ។','No orders in this group.','当前分组暂无订单。'],
 promise:['ពេលវេលាដែលបានសន្យា','Promised delivery time','承诺送达时间'],
 back:['បើកគំរូការងារ','Open workflow prototype','打开业务原型'],
 preview:['គំរូបីភាសា · មិនទាន់បកប្រែគំរូការងារទាំងមូល','Three-language preview · full workflow translation is pending','三语设计预览 · 完整业务原型尚未全部翻译'],
 reviewOrder:['មើលព័ត៌មានការបញ្ជាទិញ','Review order details','查看订单详情'],
 source:['ប្រភពការបញ្ជាទិញ','Order source','订单来源'],
 notified:['ព័ត៌មានការបញ្ជាទិញបង្ហាញនៅខាងក្រោម។','Order details are shown below.','订单详情已在下方展示。']
};
export const messages=Object.fromEntries(locales.map((locale,i)=>[locale,Object.fromEntries(Object.entries(rows).map(([key,values])=>[key,values[i]]))]));
export const resolveLocale=value=>locales.includes(value)?value:'en-US';
export function t(locale,key){return messages[resolveLocale(locale)][key]??messages['en-US'][key]??key;}
export const money=(locale,minor)=>new Intl.NumberFormat(resolveLocale(locale),{style:'currency',currency:'USD',currencyDisplay:'code',numberingSystem:'latn'}).format(minor/100);
export const date=(locale,value)=>new Intl.DateTimeFormat(resolveLocale(locale),{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Phnom_Penh',hourCycle:'h23',numberingSystem:'latn'}).format(new Date(value));

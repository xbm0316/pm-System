import { NumberInput } from '@astryxdesign/core/NumberInput'
import DatePicker from './DatePicker'
import ConfirmDataDeletion from './ConfirmDataDeletion'
import AttachmentPicker from './AttachmentPicker'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import WorkspaceDialog, { WorkspaceDialogActions } from './WorkspaceDialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Button } from '@astryxdesign/core/Button'
import { Selector } from '@astryxdesign/core/Selector'
import { Carousel } from '@astryxdesign/core/Carousel'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useHoverCard } from '@astryxdesign/core/HoverCard'
import { Link } from '@astryxdesign/core/Link'
import { useSnapPaging } from '@astryxdesign/core/SnapPaging'
import { pixel, proportional, Table, useTableStickyColumns, type TableColumn } from '@astryxdesign/core/Table'
import { Thumbnail } from '@astryxdesign/core/Thumbnail'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { useAttachmentDraft } from '../lib/useAttachmentDraft'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import Icon from './Icon'
import OperationsKnowledgeBoard, { type TutorialCard, type TutorialType } from './OperationsKnowledgeBoard'
import { MENUS, uid } from '../lib/store'
import { deleteLocalFile, deleteLocalFilesForEntity, getLocalFile, localFileUrl, type LocalAttachment } from '../lib/localFiles'
import FileAttachmentList from './FileAttachmentList'

interface OperationsWorkspaceProps {
  spaceId: string
  activeMenu: string
  searchQuery?: string
  state: OperationsState
  updateState: (change: (current: OperationsState) => OperationsState) => Promise<void>
}
type ProductConclusion = '继续研究' | '进入测试' | '准备上架' | '作为备选' | '暂停'
type ProductCurrency = 'CNY' | 'USD'
type CampaignStatus = '准备中' | '测试中' | '放量中' | '暂停'
type ReviewDecision = '继续' | '调整' | '暂停'
type OpsProduct = {
  id: string
  name: string
  description?: string
  sku?: string
  inventory?: number
  rank?: number | null
  clicks?: number | null
  image: string
  images?: string[]
  imageFileIds?: string[]
  imagePaths?: string[]
  supplier: string
  currency?: ProductCurrency
  cost: number
  price: number
  shipping: number
  paymentFee: number
  adCost: number
  refundReserve: number
  evidence: string
  competition: string
  fulfillment: string
  materials: string
  conclusion?: ProductConclusion
  attachments: string[]
  createdAt: number
}
interface OpsCampaign { id: string; name: string; platform: string; productId: string; landingPage: string; dailyBudget: number; totalBudget: number; spend: number; orders: number; revenue: number; status: CampaignStatus; notes: string; createdAt: number }
interface OpsReview { id: string; title: string; date: string; scope: string; completed: string; problems: string; insight: string; decision: ReviewDecision; nextAction: string; attachments: LocalAttachment[]; createdAt: number }
export interface OperationsState { tutorialCards: TutorialCard[]; products: OpsProduct[]; campaigns: OpsCampaign[]; reviews: OpsReview[]; knowledgeTypes?: TutorialType[] }

const TUTORIAL_BASE = 'https://ecomwith.com/zh/tutorials/basics/'
const TOOLS_BASE = 'https://ecomwith.com/zh/tools/'
const tutorialTypes: TutorialType[] = [
  { id: 'route', title: '独立站起步 · 18 节课程', description: '严格按照 Ecomwith 的学习顺序，从模式、选品、主体一路完成到上线。', color: '#0951C3' },
  { id: 'assets', title: '课程执行资产', description: '把课程中的检查清单、指标复盘和下一步行动沉淀下来。', color: '#0e9b83' },
  { id: 'tools', title: 'Ecomwith 工具', description: '直接打开教程站点提供的研究、ROAS 和 UTM 工具。', color: '#e39a26' },
  { id: 'products', title: '我的选品资料', description: '保存选品证据、报价、竞品资料和利润判断。', color: '#df6d5c' },
  { id: 'traffic', title: '投流扩展', description: '记录 Meta、Google、TikTok、GA4 和 SEO 的外部学习资料与实操。', color: '#bd5bb4' },
]
interface TutorialSeed { typeId: string; title: string; description: string; url: string; source: string; goal: string; steps: string; outputs: string }
const tutorialSeeds: TutorialSeed[] = [
  ['跨境电商与独立站：从中国供应链，认识一门面向海外的生意', '从一位顾客买杯子的过程，弄清跨境电商、品牌独立站和平台的区别。', 'cross-border-ecommerce', '明确目标市场、客户和经营方式。', '读完后写下目标市场、目标客户和购买理由。', '目标市场\\n目标客户\\n购买理由'],
  ['Shopify 独立站入门：弄清你在经营什么', '把独立站、商品、主市场、收款、履约和数据拆成一张经营地图。', 'store-basics', '知道经营链路和暂停判断。', '画出自己的经营链路，并写下第一个可复查判断。', '经营链路\\n首批商品计划'],
  ['30 天启动独立站：起步路线和顺序', '用 30 天路线排好市场、SKU、主体、现金、域名、收款、物流和数据。', 'getting-started', '形成 30 天启动计划。', '列出任务、预算、暂停线和上线检查点。', '30 天计划\\n启动预算\\n暂停线'],
  ['海外公司怎么选：如何收款', '判断主体是否能支撑收款、银行、KYC、网站身份和维护成本。', 'overseas-company-registration', '确定主体方案或暂不注册的条件。', '比较 UK、香港、美国主体并保存判断。', '主体方案\\n注册资料\\n维护成本'],
  ['独立站营业执照和主体', '核对采购、合同、开票、经营范围、收款主体和网站身份。', 'domestic-business-license', '确认国内主体的使用边界。', '记录执照、经营范围和资料留痕位置。', '执照信息\\n经营范围\\n资料留痕'],
  ['独立站启动资金：开店前要准备多少现金', '从 90 天现金视角覆盖广告、库存订金、退款和 payout 延迟。', 'personal-finance-preparation', '完成现金流和启动预算判断。', '记录固定成本、测试预算和现金缓冲。', '可用现金\\n测试预算\\n90 天现金计划'],
  ['跨境业务手机号：2FA 和账号恢复', '区分后台安全号、客服展示号和临时验证号。', 'overseas-phone-setup', '让核心账号可恢复、可交接。', '为核心账号设置 2FA 并记录恢复方式。', '安全手机号\\n恢复方式\\n交接规则'],
  ['独立站选品：需求、利润和履约验证', '用需求、竞争、利润、履约和内容表达五个证据判断商品。', 'product-research', '形成有证据的选品结论。', '完成一个商品的五类证据和利润计算。', '需求证据\\n竞品证据\\n供应商报价'],
  ['独立站域名和企业邮箱：DNS 与邮件认证', '检查 DNS、Shopify 连接和邮件认证，避免邮件进垃圾箱。', 'domain-and-email', '建立品牌入口和可靠邮件身份。', '记录域名、DNS、企业邮箱和认证状态。', '域名\\nDNS\\n企业邮箱'],
  ['Shopify 后台设置：订单链路和测试订单', '按真实订单顺序确认收钱、发货、追踪和通知链路。', 'shopify-setup', '完成一笔受控测试订单。', '验证付款、发货、邮件和订单追踪。', '测试订单\\n后台配置\\n通知证据'],
  ['Shopify 店铺结构：从导航到结账路径', '检查导航菜单、集合页、商品页、政策入口、购物车和移动端路径。', 'shopify-store-setup', '让用户能顺畅找到商品并结账。', '完成首页到结账的移动端路径检查。', '导航结构\\n移动端 QA\\n结账路径'],
  ['独立站收款准备：支付、退款与拒付证据', '验证 Shopify Payments、PayPal 和第三方支付的完整路径。', 'payment-gateway-setup', '确认收款、退款和拒付证据。', '完成成功付款、失败付款、退款和净到账测试。', '账户信息\\n费率\\n退款测试'],
  ['Shopify 商品上架：商品页、变体和移动端加购', '组织图片、规格、变体、FAQ、配送承诺和移动端加购体验。', 'product-listing', '完成一个可购买的商品页面。', '记录商品内容、变体规则和移动端检查结果。', '商品信息\\n变体规则\\nFAQ'],
  ['独立站政策页面：隐私、退款与服务条款', '让隐私、退款、服务条款和配送承诺与实际运营一致。', 'policy-pages', '建立可信、可访问的政策页面。', '保存页面链接和与实际服务的差异说明。', '政策链接\\n差异说明'],
  ['独立站物流与履约：运费、时效和订单追踪', '核对 Shopify 运费、配送时效、订单追踪和异常处理。', 'shipping-fulfillment', '形成真实可执行的履约承诺。', '记录物流方式、成本、时效和异常方案。', '运费规则\\n时效\\n异常方案'],
  ['独立站上线检查：订单、结账和数据验收', '用测试订单、结账、移动端 QA、purchase 事件和政策客服证据完成验收。', 'launch-qa', '形成上线前检查结论。', '完成上线 QA 并记录阻塞项。', '测试结果\\n数据事件\\n上线结论'],
  ['独立站客服与售后：SLA、退款和复购触达', '建立客服 SLA、异常分流、短回复模板和购后触达流程。', 'customer-care', '让首批订单有清晰的售后路径。', '准备客服入口、退款流程和回复模板。', '客服入口\\nSLA\\n回复模板'],
  ['Shopify 系统集成：一笔订单怎么跑通证据链', '核对订单邮件、付款、GA4 purchase、履约和客服查询。', 'system-integration', '让经营和数据链路可复查。', '用一笔真实或受控订单完成证据链核对。', '订单证据\\nGA4 事件\\n履约证据'],
].map(([title, description, slug, goal, steps, outputs]) => ({ typeId: 'route', title, description, url: `${TUTORIAL_BASE}${slug}`, source: 'Ecomwith', goal, steps, outputs }))
tutorialSeeds.push(
  { typeId: 'assets', title: '独立站上线执行包', description: '把核心检查清单、指标复盘表和下一步行动表集中管理。', url: `${TUTORIAL_BASE}`, source: 'Ecomwith', goal: '每节课留下可复查资产。', steps: '核心检查清单\\n指标复盘表\\n下一步行动表', outputs: '检查清单\\n指标记录\\n行动表' },
  { typeId: 'tools', title: 'Store Inspector 店铺研究', description: '用于研究店铺和竞品结构。', url: `${TOOLS_BASE}store-inspector`, source: 'Ecomwith 工具', goal: '保存研究对象和观察结论。', steps: '输入店铺\\n记录页面结构\\n保存观察', outputs: '店铺研究记录' },
  { typeId: 'tools', title: 'ROAS 计算器', description: '计算广告投入与收入的关系。', url: `${TOOLS_BASE}roas`, source: 'Ecomwith 工具', goal: '建立投流判断基线。', steps: '填写花费\\n填写收入\\n记录 ROAS', outputs: 'ROAS 结果' },
  { typeId: 'tools', title: '保本 ROAS', description: '计算覆盖商品成本和费用所需的最低 ROAS。', url: `${TOOLS_BASE}break-even-roas`, source: 'Ecomwith 工具', goal: '在投流前明确保本线。', steps: '填写成本\\n填写毛利\\n记录保本 ROAS', outputs: '保本 ROAS' },
  { typeId: 'tools', title: 'UTM 生成器', description: '为广告、内容和渠道生成可追踪链接。', url: `${TOOLS_BASE}utm-builder`, source: 'Ecomwith 工具', goal: '让来源数据可以回查。', steps: '填写来源\\n填写媒介\\n生成链接', outputs: 'UTM 链接' },
  { typeId: 'traffic', title: 'Meta / Google / TikTok 投流资料', description: '这里保存外部投流教程、广告账户资料、素材和数据追踪记录。', url: '', source: '我的外部资料', goal: '把投流学习与实际广告计划关联起来。', steps: '添加外部链接\\n记录广告账户\\n记录素材与受众', outputs: '投流资料\\n广告计划\\n数据复盘' },
)
function initialCards(): TutorialCard[] { const now = Date.now(); return tutorialSeeds.map((definition, index) => ({ id: `tutorial-${index + 1}`, ...definition, resourceType: '教程', status: '未开始', notes: '', attachments: [], nextAction: '', reviewDate: '', createdAt: now, updatedAt: now })) }
function initialState(): OperationsState { return { tutorialCards: initialCards(), products: [], campaigns: [], reviews: [], knowledgeTypes: tutorialTypes } }
export function normalizeOperationsState(value: unknown): OperationsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return initialState()
  const parsed = value as Partial<OperationsState>
  return {
    tutorialCards: Array.isArray(parsed.tutorialCards) ? parsed.tutorialCards : initialCards(),
    products: Array.isArray(parsed.products) ? parsed.products.map((item) => {
      const images = item.images?.length ? item.images : item.image ? [item.image] : []
      return { ...item, images: images.map((url, index) => item.imageFileIds?.[index] ? localFileUrl(item.imageFileIds[index]) : url) }
    }) : [],
    campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews.map((item) => ({
      ...item,
      attachments: Array.isArray(item.attachments) ? item.attachments.filter((file) => file && typeof file === 'object' && file.id) : [],
    })) : [],
    knowledgeTypes: parsed.knowledgeTypes?.length ? parsed.knowledgeTypes : tutorialTypes,
  }
}
function money(value: number) { return Number.isFinite(value) ? value.toFixed(2) : '0.00' }
function productMoney(value: number, currency: ProductCurrency = 'CNY') {
  return (currency === 'USD' ? 'US$' : '¥') + money(value)
}
const productNumberFormat = new Intl.NumberFormat('zh-CN')
const GALLERY_PAGE_SIZE = 3

function getSupplierLink(value?: string) {
  const text = value?.trim()
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function ProductTitle({ title, supplier }: { title: string; supplier: string }) {
  const href = getSupplierLink(supplier)
  const characters = Array.from(title)
  const preview = characters.length > 20 ? characters.slice(0, 20).join('') + '…' : title
  if (href) {
    return <Link className="operations-product-title" href={href} label={title} tooltip={title} target="_blank" rel="noreferrer" type="inherit">{preview}</Link>
  }
  return (
    <Tooltip content={<span className="operations-product-title-tooltip">{title}</span>} focusTrigger="always" touchTrigger="tap">
      <span className="operations-product-title" tabIndex={0}>{preview}</span>
    </Tooltip>
  )
}

function getProductImages(product: OpsProduct) {
  return product.images?.length ? product.images : product.image ? [product.image] : []
}

function ProductGalleryImage({ src, alt, maxHeight }: { src: string; alt: string; maxHeight?: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="operations-product-gallery__slide" style={{ maxBlockSize: maxHeight }}>
      {failed ? <span>图片无法加载</span> : <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
    </div>
  )
}

function ProductThumbnail({ product }: { product: OpsProduct }) {
  const images = getProductImages(product).filter(Boolean)
  const visibleImages = Math.min(images.length, GALLERY_PAGE_SIZE)
  const pageCount = Math.ceil(images.length / GALLERY_PAGE_SIZE)
  const paging = useSnapPaging()
  const label = `${product.name}图片预览`
  const trigger = useRef<HTMLButtonElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>()
  const [failedSource, setFailedSource] = useState<string>()
  const sizePreview = useCallback(() => {
    const available = Math.floor(trigger.current?.getBoundingClientRect().top ?? 0) - 48
    // Use the space above the thumbnail if the resulting preview is still legible.
    setMaxHeight(available >= 100 ? available : undefined)
  }, [])
  const gallery = useHoverCard({ label, placement: 'above', alignment: 'start', touchTrigger: 'tap', onShow: sizePreview })
  const attachTrigger = useCallback((element: HTMLButtonElement | null) => {
    trigger.current = element
    gallery.ref(element)
  }, [gallery.ref])

  const mainImage = images[0]
  if (!mainImage) return <Thumbnail className="operations-product-thumbnail" aria-label="暂无商品图片" />

  return (
    <>
      <IconButton
        ref={attachTrigger}
        className="operations-product-thumbnail"
        label={`预览 ${product.name} 图片`}
        variant="ghost"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={gallery.isOpen}
        aria-controls={gallery.isOpen ? gallery.id : undefined}
        onClick={(event) => { if (event.detail === 0) gallery.show() }}
        icon={failedSource === mainImage
          ? <Icon name="image" size={20} />
          : <img src={mainImage} alt="" loading="lazy" onError={() => setFailedSource(mainImage)} />}
      />
      {gallery.renderHoverCard(
        <Carousel
          aria-label={label}
          className="operations-product-gallery"
          style={{ '--product-gallery-visible-images': visibleImages } as CSSProperties}
          gap={2}
          hasSnap={paging}
          hasButtons={pageCount > 1}
          hasLoop
          hasEdgeFade={false}
        >
          {Array.from({ length: pageCount }, (_, page) => {
            const firstImage = page * GALLERY_PAGE_SIZE
            return (
              <div key={firstImage} className="operations-product-gallery__page">
                {images.slice(firstImage, firstImage + GALLERY_PAGE_SIZE).map((src, index) => (
                  <ProductGalleryImage
                    key={`${src}-${index}`}
                    src={src}
                    alt={`${product.name} · 第 ${firstImage + index + 1} 张图片`}
                    maxHeight={maxHeight}
                  />
                ))}
              </div>
            )
          })}
        </Carousel>,
      )}
    </>
  )
}

function OpsModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <WorkspaceDialog title={title} onClose={onClose} purpose="info" width={760}>
      {children}
    </WorkspaceDialog>
  )
}
function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <div className="operations-field"><span className="field-label">{label}{required && <span className="field-required"> *</span>}</span>{children}</div>
}
function ProductImagePicker({ images, fileIds, imagePaths, onChange, attachments }: {
  images: string[]
  fileIds: string[]
  imagePaths: string[]
  onChange: (images: string[], fileIds: string[], imagePaths: string[]) => void
  attachments: ReturnType<typeof useAttachmentDraft>
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [resolvedPaths, setResolvedPaths] = useState<string[]>(imagePaths)
  const [pendingUrls, setPendingUrls] = useState<string[]>([])
  useEffect(() => {
    const urls = attachments.files.map((file) => URL.createObjectURL(file))
    setPendingUrls(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [attachments.files])
  useEffect(() => {
    let cancelled = false
    void Promise.all(fileIds.map(async (id, index) => imagePaths[index] || (await getLocalFile(id).catch(() => null))?.relativePath || '')).then((paths) => { if (!cancelled) setResolvedPaths(paths) })
    return () => { cancelled = true }
  }, [fileIds, imagePaths])
  function removeImage(index: number) {
    if (attachments.saving) return
    if (index >= images.length) { attachments.remove(index - images.length); return }
    onChange(images.filter((_, current) => current !== index), fileIds.filter((_, current) => current !== index), resolvedPaths.filter((_, current) => current !== index))
  }
  const previews = [...images, ...pendingUrls]
  useEffect(() => { if (activeIndex >= previews.length) setActiveIndex(Math.max(previews.length - 1, 0)) }, [activeIndex, previews.length])
  return <div className="operations-image-picker">

    <div className="operations-image-picker__preview">
      {previews[activeIndex] ? <img src={previews[activeIndex]} alt={`商品主图 ${activeIndex + 1}`} /> : <div className="operations-image-picker__empty"><Icon name="image" size={30} /><strong>上传商品主图</strong><span>建议使用清晰的商品图片</span></div>}
      {previews.length > 1 && <><IconButton label="上一张" icon={<Icon name="chevronLeft" size={16} />} variant="ghost" size="sm" className="operations-image-picker__nav operations-image-picker__nav--prev" type="button" onClick={() => setActiveIndex((activeIndex - 1 + previews.length) % previews.length)} /><IconButton label="下一张" icon={<Icon name="chevronRight" size={16} />} variant="ghost" size="sm" className="operations-image-picker__nav operations-image-picker__nav--next" type="button" onClick={() => setActiveIndex((activeIndex + 1) % previews.length)} /></>}
    </div>
    <div className="operations-image-picker__footer"><div className="operations-image-picker__list">
      {previews.map((image, index) => <div className={`operations-image-picker__item${index === activeIndex ? ' is-active' : ''}`} key={`${image.slice(0, 24)}-${index}`}><IconButton label={`查看商品图 ${index + 1}`} icon={<img src={image} alt={`商品图 ${index + 1}`} />} variant="ghost" size="sm" className="operations-image-picker__select" type="button" onClick={() => setActiveIndex(index)} /><IconButton label={`删除商品图 ${index + 1}`} icon={<Icon name="close" size={11} />} variant="ghost" size="sm" className="operations-image-picker__remove" type="button" isDisabled={attachments.saving} onClick={() => removeImage(index)} /><small className="operations-image-picker__path">{index >= images.length ? '待保存' : resolvedPaths[index] || '路径暂不可用'}</small></div>)}

    </div><AttachmentPicker label="添加图片" accept="image/*" description="首张图片将作为商品主图。" files={attachments.files} onRemove={attachments.remove} isDisabled={attachments.saving} onFiles={attachments.add} /><FileAttachmentList files={images.map((image, index) => ({ id: fileIds[index] || 'product-image-' + index, fileId: fileIds[index], name: `商品图片 ${index + 1}`, url: image, kind: 'image' as const, relativePath: resolvedPaths[index] }))} compact /></div>
  </div>
}

export default function OperationsWorkspace({ state, updateState, spaceId, activeMenu, searchQuery = '' }: OperationsWorkspaceProps) {
  const productAttachments = useAttachmentDraft({ maxFiles: Number.POSITIVE_INFINITY })
  const reviewAttachments = useAttachmentDraft()
  const [productDraft, setProductDraft] = useState<OpsProduct | null>(null)
  const [campaignDraft, setCampaignDraft] = useState<OpsCampaign | null>(null)
  const [reviewDraft, setReviewDraft] = useState<OpsReview | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'campaign' | 'ops-review'; id: string; name: string } | null>(null)
  const [productTab, setProductTab] = useState<'basic' | 'pricing'>('basic')
  const stickyProductActions = useTableStickyColumns<OpsProduct>({ endKeys: ['actions'] })
  const menus = MENUS['独立站电商运营']
  const query = searchQuery.trim().toLocaleLowerCase()
  const knowledgeTypes = state.knowledgeTypes?.length ? state.knowledgeTypes : tutorialTypes
  const products = useMemo(() => state.products.filter((item) => !query || `${item.name} ${item.supplier}`.toLocaleLowerCase().includes(query)), [query, state.products])
  const campaigns = useMemo(() => state.campaigns.filter((item) => !query || `${item.name} ${item.platform} ${item.status}`.toLocaleLowerCase().includes(query)), [query, state.campaigns])
  function newProduct() { productAttachments.reset(); setProductTab('basic'); setProductDraft({ id: uid(), name: '', description: '', sku: '', image: '', images: [], imageFileIds: [], imagePaths: [], supplier: '', cost: 0, price: 0, shipping: 0, paymentFee: 0, adCost: 0, refundReserve: 0, evidence: '', competition: '', fulfillment: '', materials: '', attachments: [], createdAt: Date.now() }) }
  function editProduct(product: OpsProduct) {
    productAttachments.reset()
    setProductTab('basic')
    setProductDraft({ ...product, images: getProductImages(product) })
  }
  function closeProduct() {
    if (productAttachments.saving) return
    productAttachments.reset()
    setProductDraft(null)
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const draft = productDraft
    if (!draft?.name.trim() || (productTab === 'basic' && !draft.description) || event.currentTarget.querySelector('[aria-invalid="true"]')) return
    const previous = state.products.find((item) => item.id === draft.id)
    const saved = await productAttachments.save({ spaceId, entityType: 'product', entityId: draft.id, pathSegments: ['选品', draft.name.trim(), '商品图片'] }, (added) => {
      const existing = draft.images || []
      const images = [...existing, ...added.map((file) => file.url)]
      const next = {
        ...draft, images, image: images[0] || '',
        imageFileIds: [...existing.map((_, index) => draft.imageFileIds?.[index] || ''), ...added.map((file) => file.fileId)],
        imagePaths: [...existing.map((_, index) => draft.imagePaths?.[index] || ''), ...added.map((file) => file.relativePath || '')],
      }
      return updateState((current) => ({ ...current, products: [...current.products.filter((item) => item.id !== draft.id), next] }))
    })
    if (!saved) return
    const removed = (previous?.imageFileIds || []).filter((id) => !draft.imageFileIds?.includes(id))
    void Promise.allSettled(removed.map((id) => deleteLocalFile(id)))
    setProductDraft(null)
  }
  function newCampaign() { setCampaignDraft({ id: uid(), name: '', platform: 'Meta', productId: '', landingPage: '', dailyBudget: 0, totalBudget: 0, spend: 0, orders: 0, revenue: 0, status: '准备中', notes: '', createdAt: Date.now() }) }
  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const draft = campaignDraft
    if (!draft?.name.trim() || event.currentTarget.querySelector('[aria-invalid="true"]')) return
    try {
      await updateState((current) => ({ ...current, campaigns: [...current.campaigns.filter((item) => item.id !== draft.id), draft] }))
      setCampaignDraft(null)
    } catch { /* Workspace reports the sync error while preserving the draft. */ }
  }
  function newReview() { reviewAttachments.reset(); setReviewDraft({ id: uid(), title: '', date: new Date().toISOString().slice(0, 10), scope: '教程学习', completed: '', problems: '', insight: '', decision: '继续', nextAction: '', attachments: [], createdAt: Date.now() }) }
  function closeReview() {
    if (reviewAttachments.saving) return
    reviewAttachments.reset()
    setReviewDraft(null)
  }
  async function saveReview(event: FormEvent) {
    event.preventDefault()
    const draft = reviewDraft
    if (!draft?.title.trim()) return
    const previous = state.reviews.find((item) => item.id === draft.id)
    const saved = await reviewAttachments.save({ spaceId, entityType: 'ops-review', entityId: draft.id, pathSegments: ['独立站运营', '复盘', draft.id] }, (added) => {
      const next = { ...draft, attachments: [...draft.attachments, ...added] }
      return updateState((current) => ({ ...current, reviews: [...current.reviews.filter((item) => item.id !== draft.id), next] }))
    })
    if (!saved) return
    const removed = (previous?.attachments || []).filter((file) => !draft.attachments.some((item) => item.id === file.id))
    void Promise.allSettled(removed.map((file) => deleteLocalFile(file.fileId || file.id)))
    setReviewDraft(null)
  }
  async function removeRecord() {
    if (!deleteTarget) return
    const { type, id } = deleteTarget
    await deleteLocalFilesForEntity(type, id, spaceId)
    await updateState((current) => {
      if (type === 'product') return { ...current, products: current.products.filter((item) => item.id !== id) }
      if (type === 'ops-review') return { ...current, reviews: current.reviews.filter((item) => item.id !== id) }
      return { ...current, campaigns: current.campaigns.filter((item) => item.id !== id) }
    })
  }
  function renderProducts() {
    const labels = { price: '售价', cost: '供应商价格', shipping: '物流成本', paymentFee: '支付手续费', adCost: '广告成本', refundReserve: '退款预留' }
    const columns: TableColumn<OpsProduct>[] = [
      { key: 'image', header: '图片', width: pixel(76), align: 'center', renderCell: (product) => <ProductThumbnail product={product} /> },
      { key: 'name', header: '标题', width: pixel(216), align: 'center', renderCell: (product) => <ProductTitle title={product.name} supplier={product.supplier} /> },
      { key: 'cost', header: '供应商价格', width: proportional(1, { minWidth: 112 }), align: 'center', renderCell: (product) => productMoney(product.cost, product.currency) },
      { key: 'price', header: '售价', width: proportional(1, { minWidth: 96 }), align: 'center', renderCell: (product) => productMoney(product.price, product.currency) },
      { key: 'rank', header: '排名', width: proportional(1, { minWidth: 72 }), align: 'center', renderCell: (product) => product.rank == null ? '—' : productNumberFormat.format(product.rank) },
      { key: 'clicks', header: '点击量', width: proportional(1, { minWidth: 88 }), align: 'center', renderCell: (product) => product.clicks == null ? '—' : productNumberFormat.format(product.clicks) },
      { key: 'adCost', header: '广告成本', width: proportional(1, { minWidth: 104 }), align: 'center', renderCell: (product) => productMoney(product.adCost, product.currency) },
      {
        key: 'actions', header: '操作', width: pixel(104), align: 'center',
        renderCell: (product) => (
          <div className="operations-product-actions">
            <IconButton label={`编辑商品 ${product.name}`} variant="ghost" size="sm" icon={<Icon name="edit" size={14} />} type="button" onClick={() => editProduct(product)} />
            <IconButton label={`删除商品 ${product.name}`} variant="ghost" size="sm" icon={<Icon name="trash" size={14} />} type="button" onClick={() => setDeleteTarget({ type: 'product', id: product.id, name: product.name })} />
          </div>
        ),
      },
    ]
    return <>
      <div className="operations-section-head">
        <Button label="添加商品" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={newProduct} />
      </div>
      <Card padding={0}>
        <Table
          aria-label="选品列表"
          className="operations-product-table"
          data={products}
          idKey="id"
          columns={columns}
          plugins={{ stickyColumns: stickyProductActions }}
          density="balanced"
          hasHover
          emptyState={<EmptyState
            title={query ? '没有匹配的商品' : '还没有商品'}
            description={query ? '试试其他搜索关键词。' : '点击「添加商品」建立第一条选品记录。'}
            isCompact
          />}
        />
      </Card>
      {productDraft && (() => {
        const currency = productDraft.currency ?? 'CNY'
        const contribution = productDraft.price - productDraft.cost - productDraft.shipping - productDraft.paymentFee - productDraft.refundReserve
        const margin = productDraft.price > 0 ? contribution / productDraft.price * 100 : 0
        const breakEvenRoas = contribution > 0 ? productDraft.price / contribution : 0
        const source = getSupplierLink(productDraft.supplier)
        const title = state.products.some((product) => product.id === productDraft.id) ? '编辑商品' : '添加商品'
        return <OpsModal title={title} onClose={closeProduct}>
          <form className="operations-product-form" onSubmit={(event) => void saveProduct(event)}>
            <TabList value={productTab} onChange={(tab) => setProductTab(tab === 'pricing' ? 'pricing' : 'basic')} role="tablist" hasDivider>
              <Tab value="basic" label="商品信息" panelId="ops-product-info" />
              <Tab value="pricing" label="定价与成本" panelId="ops-product-pricing" />
            </TabList>
            {productTab === 'basic' && <section id="ops-product-info" role="tabpanel" aria-label="商品信息" className="operations-product-form__section"><div className="operations-product-form__title">商品信息</div><div className="operations-product-form__grid">
              <Field label="商品标题" required><TextInput label="商品标题" value={productDraft.name} isLabelHidden width="100%" isRequired hasAutoFocus placeholder="例如：便携榨汁杯" onChange={(nextValue) => setProductDraft({ ...productDraft, name: nextValue })} /></Field>
              <Field label="供应商链接">
                <TextInput label="供应商链接" isLabelHidden width="100%" value={productDraft.supplier} placeholder="粘贴供应商商品链接" onChange={(value) => setProductDraft({ ...productDraft, supplier: value })} />
                {source && <Link href={source} isExternalLink referrerPolicy="no-referrer" type="supporting" className="operations-product-source">打开供应商链接</Link>}
              </Field>
              <Field label="SKU"><TextInput label="SKU" isLabelHidden width="100%" value={productDraft.sku || ''} placeholder="商品编码" onChange={(nextValue) => setProductDraft({ ...productDraft, sku: nextValue })} /></Field>
              <NumberInput label="排名" value={productDraft.rank ?? null} width="100%" min={1} isIntegerOnly isWheelEnabled={false} hasClear onChange={(rank) => setProductDraft((draft) => draft && { ...draft, rank })} />
              <NumberInput label="点击量" value={productDraft.clicks ?? null} width="100%" min={0} isIntegerOnly isWheelEnabled={false} hasClear onChange={(clicks) => setProductDraft((draft) => draft && { ...draft, clicks })} />
              <Field label="商品描述" required><TextArea label="商品描述" value={productDraft.description || ''} isLabelHidden width="100%" isRequired rows={4} placeholder="商品卖点、适用人群和选品判断" onChange={(nextValue) => setProductDraft({ ...productDraft, description: nextValue })} /></Field>
              <Field label="商品图片"><ProductImagePicker attachments={productAttachments} images={productDraft.images || []} fileIds={productDraft.imageFileIds || []} imagePaths={productDraft.imagePaths || []} onChange={(images, imageFileIds, imagePaths) => setProductDraft({ ...productDraft, images, imageFileIds, imagePaths, image: images[0] || '' })} /></Field>
            </div></section>}
            {productTab === 'pricing' && <section id="ops-product-pricing" role="tabpanel" aria-label="定价与成本" className="operations-product-form__section"><div className="operations-product-form__title">定价与成本</div><div className="operations-product-form__grid">
              {(['price', 'cost', 'shipping', 'paymentFee', 'adCost', 'refundReserve'] as const).map((key) => <Field key={key} label={labels[key]}><NumberInput label={labels[key]} value={productDraft[key]} isLabelHidden width="100%" min={0} step={0.01} units={currency} isWheelEnabled={false} onChange={(value) => setProductDraft((draft) => draft && { ...draft, [key]: value })} /></Field>)}
              <Selector label="金额币种" width="100%" value={currency}
                options={[{ value: 'CNY', label: '人民币（CNY）' }, { value: 'USD', label: '美元（USD）' }]}
                onChange={(value) => setProductDraft((draft) => draft && { ...draft, currency: value === 'USD' ? 'USD' : 'CNY' })} />
            </div><div className="operations-calculator" aria-live="polite"><div className="operations-calculator__head"><strong>利润预估</strong><a href="https://ecomwith.com/zh/tools/pricing" target="_blank" rel="noreferrer">Ecomwith 定价工具 <Icon name="link" size={11} /></a></div><div className="operations-calculator__grid"><span>贡献利润<strong>{productMoney(contribution, currency)}</strong></span><span>广告后利润<strong>{productMoney(contribution - productDraft.adCost, currency)}</strong></span><span>贡献毛利率<strong>{margin.toFixed(1)}%</strong></span><span>保本 CPA<strong>{productMoney(Math.max(contribution, 0), currency)}</strong></span><span>保本 ROAS<strong>{breakEvenRoas ? breakEvenRoas.toFixed(2) : '—'}</strong></span></div><p>贡献利润 = 售价 − 采购 − 物流 − 手续费 − 退款预留；投流成本单独计算广告后利润。<a href="https://ecomwith.com/zh/tools/break-even-roas" target="_blank" rel="noreferrer">查看公式来源</a></p></div></section>}
            {productAttachments.error && <Banner status="error" title={<>{productAttachments.error}</>} />}
            <WorkspaceDialogActions><Button label="取消" variant="ghost" type="button" isDisabled={productAttachments.saving} onClick={closeProduct} /><Button label="保存商品" variant="primary" type="submit" isLoading={productAttachments.saving} isDisabled={!productDraft.name.trim() || (productTab === 'basic' && !productDraft.description)} /></WorkspaceDialogActions>
          </form>
        </OpsModal>
      })()}
    </>
  }
  function renderAds() {
    const spend = campaigns.reduce((sum, item) => sum + item.spend, 0)
    const revenue = campaigns.reduce((sum, item) => sum + item.revenue, 0)
    return <>
      <div className="operations-section-head operations-section-head--compact">
        <Button label="新增投流计划" variant="primary" onClick={newCampaign} />
      </div>
      <div className="operations-kpi-row">
        <div><span>广告花费</span><strong>¥{money(spend)}</strong></div>
        <div><span>广告收入</span><strong>¥{money(revenue)}</strong></div>
        <div><span>ROAS</span><strong>{spend ? (revenue / spend).toFixed(2) : '0.00'}</strong></div>
      </div>
      <div className="operations-card-grid">
        {campaigns.length ? campaigns.map((item) => {
          const roas = item.spend ? item.revenue / item.spend : 0
          const cpa = item.orders ? item.spend / item.orders : 0
          const product = state.products.find((entry) => entry.id === item.productId)
          return <ClickableCard padding={0} className="operations-data-card" key={item.id} label={`查看投流计划 ${item.name}`} onClick={() => setCampaignDraft({ ...item })}>
            <div className="operations-data-card__head">
              <span className="operations-status operations-status--进行中">{item.status}</span>
              <div>
                <IconButton label="编辑" variant="ghost" size="sm" icon={<Icon name="edit" size={13} />} type="button" onClick={() => setCampaignDraft({ ...item })} />
                <IconButton label="删除" variant="ghost" size="sm" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteTarget({ type: 'campaign', id: item.id, name: item.name })} />
              </div>
            </div>
            <h2>{item.name}</h2>
            <p className="operations-muted">{item.platform} · {product?.name || '未关联商品'}</p>
            <div className="operations-metrics">
              <span>花费<strong>¥{money(item.spend)}</strong></span>
              <span>订单<strong>{item.orders}</strong></span>
              <span>ROAS<strong>{roas.toFixed(2)}</strong></span>
              <span>CPA<strong>¥{money(cpa)}</strong></span>
            </div>
            <p className="operations-card-copy">{item.notes || '暂无投放结论'}</p>
          </ClickableCard>
        }) : <div className="operations-empty">还没有投流计划，选品进入测试后可以在这里建立第一条广告记录。</div>}
      </div>
      {campaignDraft && <OpsModal title={campaignDraft.name ? '编辑投流计划' : '新增投流计划'} onClose={() => setCampaignDraft(null)}>
        <form className="operations-form-grid" onSubmit={saveCampaign}>
          <Field label="计划名称" required>
            <TextInput label="计划名称" value={campaignDraft.name} isLabelHidden width="100%" isRequired hasAutoFocus onChange={(nextValue) => setCampaignDraft({ ...campaignDraft, name: nextValue })} />
          </Field>
          <Selector
            label="投放平台"
            width="100%"
            options={['Meta', 'Google', 'TikTok', '其他']}
            value={campaignDraft.platform}
            onChange={(platform) => setCampaignDraft({ ...campaignDraft, platform })}
          />
          <Selector
            label="关联商品"
            width="100%"
            options={[{ value: '', label: '暂不关联' }, ...state.products.map(({ id, name }) => ({ value: id, label: name }))]}
            placeholder="暂不关联"
            value={campaignDraft.productId}
            onChange={(productId) => setCampaignDraft({ ...campaignDraft, productId })}
          />
          <Field label="落地页">
            <TextInput label="落地页" isLabelHidden width="100%" type="url" value={campaignDraft.landingPage} onChange={(nextValue) => setCampaignDraft({ ...campaignDraft, landingPage: nextValue })} />
          </Field>
          <Selector
            label="投放状态"
            width="100%"
            options={['准备中', '测试中', '放量中', '暂停']}
            value={campaignDraft.status}
            onChange={(status) => setCampaignDraft({ ...campaignDraft, status: status as CampaignStatus })}
          />
          {([
            ['dailyBudget', '日预算'],
            ['totalBudget', '总预算'],
            ['spend', '已花费'],
            ['orders', '订单数'],
            ['revenue', '广告收入'],
          ] as const).map(([key, label]) => <Field key={key} label={label}>
            <NumberInput label={label} value={campaignDraft[key]} isLabelHidden width="100%" min={0} step={0.01} isWheelEnabled={false} onChange={(nextValue) => setCampaignDraft({ ...campaignDraft, [key]: nextValue })} />
          </Field>)}
          <Field label="投放结论">
            <TextArea label="投放结论" isLabelHidden width="100%" rows={3} value={campaignDraft.notes} onChange={(nextValue) => setCampaignDraft({ ...campaignDraft, notes: nextValue })} />
          </Field>
          <WorkspaceDialogActions>
            <Button label="取消" variant="ghost" onClick={() => setCampaignDraft(null)} />
            <Button label="保存计划" variant="primary" type="submit" isDisabled={!campaignDraft.name.trim()} />
          </WorkspaceDialogActions>
        </form>
      </OpsModal>}
    </>
  }
  function renderReviews() { const reviews = state.reviews.filter((item) => !query || `${item.title} ${item.scope} ${item.insight}`.toLocaleLowerCase().includes(query)); return <><div className="operations-section-head"><div><div className="operations-eyebrow">从学习到行动</div><h1>学习复盘</h1><p>记录学到什么、做了什么、哪里不同，以及下一步要验证什么。</p></div><Button label="新增复盘" variant="primary" icon={<Icon name="plus" size={14} />} type="button" onClick={newReview} /></div><div className="operations-card-grid">{reviews.length ? reviews.map((item) => <ClickableCard padding={0} className="operations-data-card" key={item.id} label={`查看复盘 ${item.title}`} onClick={() => { reviewAttachments.reset(); setReviewDraft({ ...item }) }}><div className="operations-data-card__head"><span className="operations-status operations-status--进行中">{item.decision}</span><div><IconButton label="编辑" variant="ghost" size="sm" icon={<Icon name="edit" size={13} />} type="button" onClick={() => { reviewAttachments.reset(); setReviewDraft({ ...item }) }} /><IconButton label="删除" variant="ghost" size="sm" icon={<Icon name="trash" size={13} />} type="button" onClick={() => setDeleteTarget({ type: 'ops-review', id: item.id, name: item.title })} /></div></div><h2>{item.title}</h2><p className="operations-muted">{item.date} · {item.scope}</p><p className="operations-card-copy"><strong>完成：</strong>{item.completed || '暂无记录'}</p><p className="operations-card-copy"><strong>洞察：</strong>{item.insight || '暂无记录'}</p><FileAttachmentList files={item.attachments} compact /><div className="operations-card-meta">下一步：{item.nextAction || '待填写'}</div></ClickableCard>) : <div className="operations-empty">还没有复盘记录，完成一节教程或一次投放后记录判断。</div>}</div>{reviewDraft && <OpsModal title={reviewDraft.title ? '编辑学习复盘' : '新增学习复盘'} onClose={closeReview}><form className="operations-form-grid" onSubmit={(event) => void saveReview(event)}><Field label="复盘标题" required><TextInput label="复盘标题" value={reviewDraft.title} isLabelHidden width="100%" isRequired hasAutoFocus onChange={(nextValue) => setReviewDraft({ ...reviewDraft, title: nextValue })} /></Field><Field label="日期"><DatePicker label="复盘日期" value={reviewDraft.date} onChange={(nextValue) => setReviewDraft({ ...reviewDraft, date: nextValue })} /></Field><Field label="复盘范围"><TextInput label="复盘范围" isLabelHidden width="100%" value={reviewDraft.scope} onChange={(nextValue) => setReviewDraft({ ...reviewDraft, scope: nextValue })} /></Field><Selector label="结论" width="100%" value={reviewDraft.decision} options={['继续', '调整', '暂停']} onChange={(decision) => setReviewDraft({ ...reviewDraft, decision: decision as ReviewDecision })} /><Field label="完成了什么"><TextArea label="完成了什么" isLabelHidden width="100%" rows={4} value={reviewDraft.completed} onChange={(nextValue) => setReviewDraft({ ...reviewDraft, completed: nextValue })} /></Field><Field label="问题与差异"><TextArea label="问题与差异" isLabelHidden width="100%" rows={4} value={reviewDraft.problems} onChange={(nextValue) => setReviewDraft({ ...reviewDraft, problems: nextValue })} /></Field><Field label="关键洞察"><TextArea label="关键洞察" isLabelHidden width="100%" rows={4} value={reviewDraft.insight} onChange={(nextValue) => setReviewDraft({ ...reviewDraft, insight: nextValue })} /></Field><Field label="下一步行动"><TextArea label="下一步行动" isLabelHidden width="100%" rows={4} value={reviewDraft.nextAction} onChange={(nextValue) => setReviewDraft({ ...reviewDraft, nextAction: nextValue })} /></Field><Field label="关联资料"><AttachmentPicker label="添加附件" files={reviewAttachments.files} onRemove={reviewAttachments.remove} isDisabled={reviewAttachments.saving} onFiles={(files) => reviewAttachments.add(files, reviewDraft.attachments)} /><FileAttachmentList files={reviewDraft.attachments} onDelete={reviewAttachments.saving ? undefined : (file) => setReviewDraft({ ...reviewDraft, attachments: reviewDraft.attachments.filter((item) => item.id !== file.id) })} compact />{reviewAttachments.error && <Banner status="error" title={<>{reviewAttachments.error}</>} />}</Field><WorkspaceDialogActions><Button label="取消" variant="ghost" type="button" isDisabled={reviewAttachments.saving} onClick={closeReview} /><Button label="保存复盘" variant="primary" type="submit" /></WorkspaceDialogActions></form></OpsModal>}</> }
  const activeMenuDef = menus.find((menu) => menu.key === activeMenu) || menus[0]
  if (activeMenu !== 'ops-products' && activeMenu !== 'ops-ads') {
    return <OperationsKnowledgeBoard
      knowledgeTypes={knowledgeTypes}
      tutorialCards={state.tutorialCards}
      searchQuery={searchQuery}
      onChange={(update) => updateState((current) => ({
        ...current,
        ...update({ knowledgeTypes: current.knowledgeTypes?.length ? current.knowledgeTypes : tutorialTypes, tutorialCards: current.tutorialCards }),
      }))}
    />
  }
  return <div className="operations-workspace">
    <div className="operations-workspace__body">{activeMenu === 'ops-products' ? renderProducts() : renderAds()}</div>
    {activeMenuDef && <span className="sr-only">{activeMenuDef.label}</span>}
    {deleteTarget && <ConfirmDataDeletion title={'删除「' + deleteTarget.name + '」？'} onClose={() => setDeleteTarget(null)} onDelete={removeRecord} />}
  </div>
}

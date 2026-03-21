import Link from "next/link";
import styles from "./nurse.module.css";

const quickActions = [
  {
    href: "/nurse/news",
    icon: "📰",
    title: "ข่าวห้องพยาบาล",
    text: "ติดตามประกาศวัคซีน กิจกรรมสุขภาพ และข้อมูลสำคัญรายสัปดาห์",
    iconClass: styles.iconBlue
  },
  {
    href: "/nurse/dashboard#today-shift",
    icon: "👩‍⚕️",
    title: "เวรวันนี้",
    text: "ดูตารางเจ้าหน้าที่เวร ช่วงเวลา และช่องทางติดต่อฉุกเฉิน",
    iconClass: styles.iconGreen
  },
  {
    href: "/nurse/symptom",
    icon: "🩺",
    title: "แจ้งอาการ",
    text: "บันทึกอาการล่วงหน้าเพื่อจัดคิวและลดเวลารอหน้าห้องพยาบาล",
    iconClass: styles.iconOrange
  },
  {
    href: "/nurse/queue",
    icon: "📋",
    title: "ดูคิว",
    text: "ตรวจสอบคิวผู้ป่วยและสถานะล่าสุดแบบเรียลไทม์",
    iconClass: styles.iconBlue
  },
  {
    href: "/nurse/review",
    icon: "💬",
    title: "ประเมินบริการ",
    text: "ให้คะแนนการบริการ ความรวดเร็ว และความพึงพอใจ",
    iconClass: styles.iconYellow
  },
  {
    href: "/nurse/video",
    icon: "📹",
    title: "วิดีโอคอล",
    text: "เปิดห้องคอลติดตามอาการเบื้องต้นได้ทันที",
    iconClass: styles.iconBlue
  },
  {
    href: "/nurse/login",
    icon: "🔐",
    title: "Admin Login",
    text: "เข้าสู่ระบบผู้ดูแลเพื่อจัดการข้อมูลนักศึกษา ยา คิว และรายงาน",
    iconClass: styles.iconRed
  }
];

const heroPills = ["ดูบนมือถือได้", "ประกาศหมุนอัตโนมัติ", "เชื่อมข้อมูลห้องพยาบาล"];

const serviceHighlights = [
  { label: "เวลาเปิดบริการ", value: "08:00 - 20:00" },
  { label: "บริการเด่น", value: "คัดกรอง - จ่ายยา - ติดตามอาการ" },
  { label: "พร้อมใช้งาน", value: "นักศึกษา / ครู / ผู้ดูแล" }
];

export default function NurseHomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroLead}>
            <span className={styles.heroBadge}>COLLEGE CARE DESK</span>
            <h2 className={styles.heroTitle}>ศูนย์ดูแลสุขภาพนักศึกษาในสไตล์ที่อบอุ่นและเป็นระเบียบ</h2>
            <p className={styles.heroText}>
              ออกแบบสำหรับห้องพยาบาลวิทยาลัยให้ดูน่าเชื่อถือ ใช้งานง่าย และเห็นข้อมูลสำคัญทันทีทั้งข่าวประจำวัน ตารางเวร
              และเมนูบริการหลักของนักศึกษา
            </p>
            <div className={styles.heroPills}>
              {heroPills.map((pill) => (
                <span key={pill} className={styles.heroPill}>
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroCrestWrap}>
              <div className={styles.heroCrestGlow} />
              <img src="/logo.png" alt="ตราวิทยาลัย" className={styles.heroCrest} />
            </div>

            <div className={styles.heroInfoCard}>
              <p className={styles.heroInfoLabel}>ภาพรวมบริการวันนี้</p>
              <p className={styles.heroInfoValue}>ระบบพร้อมต้อนรับนักศึกษาทั้งงานคัดกรอง ข่าวสาร และติดตามอาการ</p>
              <div className={styles.heroMiniStatGrid}>
                {serviceHighlights.map((item) => (
                  <div key={item.label} className={styles.heroMiniStat}>
                    <p className={styles.heroMiniLabel}>{item.label}</p>
                    <p className={styles.heroMiniValue}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sectionCluster}>
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>Student Services</p>
          <h3 className={styles.sectionDisplay}>เมนูใช้งานหลักสำหรับนักศึกษาและผู้มาติดต่อ</h3>
        </div>

        <div className={styles.cardGrid}>
          {quickActions.map((card) => (
            <Link key={card.title} href={card.href} className={styles.menuCard}>
              <span className={`${styles.cardIcon} ${card.iconClass}`}>{card.icon}</span>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardText}>{card.text}</p>
              <span className={styles.cardAction}>เข้าเมนู →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ข่าวประจำวันนี้</h3>
          </div>
          <ul className={styles.listPlain}>
            <li>เปิดลงทะเบียนฉีดวัคซีนไข้หวัดใหญ่ วันที่ 18-20 มีนาคม 2026</li>
            <li>แนะนำให้นักศึกษาดื่มน้ำอย่างน้อย 6-8 แก้วต่อวันช่วงอากาศร้อน</li>
            <li>นักศึกษาที่มีโรคประจำตัวควรอัปเดตข้อมูลในระบบทุกต้นภาค</li>
          </ul>
          <Link href="/nurse/news" className={`${styles.button} ${styles.btnPrimary}`}>
            📰 ดูข่าวทั้งหมด
          </Link>
        </article>

        <article className={styles.panel} id="today-shift">
          <div>
            <h3 className={styles.sectionTitle}>เวรวันนี้</h3>
          </div>
          <div className={styles.shiftCard}>
            <p className={styles.infoText}>ช่วงเช้า (08:00 - 12:00)</p>
            <p className={styles.infoValue}>พยาบาลวิลาสินี | ต่อ 108</p>
          </div>
          <div className={styles.shiftCard}>
            <p className={styles.infoText}>ช่วงบ่าย (12:00 - 16:00)</p>
            <p className={styles.infoValue}>พยาบาลธนภรณ์ | ต่อ 108</p>
          </div>
          <div className={styles.shiftCard}>
            <p className={styles.infoText}>เวรฉุกเฉิน (16:00 - 20:00)</p>
            <p className={styles.infoValue}>พยาบาลสุจิตรา | ต่อ 118</p>
          </div>
        </article>
      </section>
    </>
  );
}

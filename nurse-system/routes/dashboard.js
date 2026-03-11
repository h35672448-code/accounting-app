const express = require("express");
const { pool } = require("../database/db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { asyncHandler } = require("./helpers");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("admin", "nurse", "viewer"));

router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [[todayPatientsRow]] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        FROM visits
        WHERE DATE(visit_at) = CURRENT_DATE()
      `
    );

    const [[severeTodayRow]] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        FROM visits
        WHERE DATE(visit_at) = CURRENT_DATE() AND severity = 'หนัก'
      `
    );

    const [[lowStockRow]] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        FROM medicines
        WHERE stock_qty <= reorder_level
      `
    );

    const [[feedbackAvgRow]] = await pool.execute(
      `
        SELECT ROUND(AVG(
          CASE mood
            WHEN 'ดีมาก' THEN 5
            WHEN 'ดี' THEN 4
            WHEN 'ปานกลาง' THEN 3
            WHEN 'แย่' THEN 2
            ELSE 0
          END
        ), 2) AS score
        FROM feedback
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `
    );

    const [[topSymptomRow]] = await pool.execute(
      `
        SELECT symptom, COUNT(*) AS total
        FROM visits
        WHERE visit_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY symptom
        ORDER BY total DESC
        LIMIT 1
      `
    );

    const [[topMedicineRow]] = await pool.execute(
      `
        SELECT m.name, SUM(ABS(msl.qty_change)) AS total
        FROM medicine_stock_logs msl
        INNER JOIN medicines m ON m.id = msl.medicine_id
        WHERE msl.action_type = 'issue'
          AND msl.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY m.id, m.name
        ORDER BY total DESC
        LIMIT 1
      `
    );

    const [openAlerts] = await pool.execute(
      `
        SELECT id, alert_type, message, created_at
        FROM alerts
        WHERE status = 'open'
        ORDER BY created_at DESC
        LIMIT 10
      `
    );

    res.json({
      ok: true,
      data: {
        today_patients: todayPatientsRow?.total || 0,
        severe_today: severeTodayRow?.total || 0,
        low_stock_items: lowStockRow?.total || 0,
        feedback_score_30d: Number(feedbackAvgRow?.score || 0),
        top_symptom_30d: topSymptomRow || null,
        top_medicine_30d: topMedicineRow || null,
        open_alerts: openAlerts
      }
    });
  })
);

module.exports = router;

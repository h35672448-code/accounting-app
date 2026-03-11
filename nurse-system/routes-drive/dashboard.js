const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { asyncHandler, readAll, toNumber } = require("./helpers");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("admin", "nurse", "viewer"));

function sameDate(dateA, dateB) {
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [visits, medicines, feedbackRows, alerts, stockLogs] = await Promise.all([
      readAll("visits"),
      readAll("medicines"),
      readAll("feedback"),
      readAll("alerts"),
      readAll("medicine_stock_logs")
    ]);

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayVisits = visits.filter((visit) => {
      const visitDate = new Date(visit.visit_at || visit.created_at);
      return !Number.isNaN(visitDate.getTime()) && sameDate(visitDate, now);
    });

    const severeToday = todayVisits.filter((visit) => String(visit.severity) === "หนัก");
    const lowStockItems = medicines.filter((medicine) => toNumber(medicine.stock_qty) <= toNumber(medicine.reorder_level));

    const scoreMap = { ดีมาก: 5, ดี: 4, ปานกลาง: 3, แย่: 2 };
    const feedback30d = feedbackRows.filter((item) => {
      const created = new Date(item.created_at);
      return !Number.isNaN(created.getTime()) && created >= last30Days;
    });

    const feedbackScore =
      feedback30d.length === 0
        ? 0
        : Number(
            (
              feedback30d.reduce((sum, item) => sum + (scoreMap[String(item.mood)] || 0), 0) / feedback30d.length
            ).toFixed(2)
          );

    const symptomCount = {};
    visits.forEach((visit) => {
      const visitDate = new Date(visit.visit_at || visit.created_at);
      if (Number.isNaN(visitDate.getTime()) || visitDate < last30Days) return;
      const symptom = String(visit.symptom || "").trim();
      if (!symptom) return;
      symptomCount[symptom] = (symptomCount[symptom] || 0) + 1;
    });

    const topSymptomEntry = Object.entries(symptomCount).sort((a, b) => b[1] - a[1])[0] || null;

    const medicineUsage = {};
    stockLogs.forEach((log) => {
      const created = new Date(log.created_at);
      if (Number.isNaN(created.getTime()) || created < last30Days) return;
      if (String(log.action_type) !== "issue") return;
      const medicineId = toNumber(log.medicine_id);
      medicineUsage[medicineId] = (medicineUsage[medicineId] || 0) + Math.abs(toNumber(log.qty_change));
    });

    const topMedicineEntry = Object.entries(medicineUsage).sort((a, b) => b[1] - a[1])[0] || null;
    const topMedicine = topMedicineEntry
      ? medicines.find((medicine) => toNumber(medicine.id) === Number(topMedicineEntry[0]))
      : null;

    const openAlerts = alerts
      .filter((alert) => String(alert.status || "") === "open")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    res.json({
      ok: true,
      data: {
        today_patients: todayVisits.length,
        severe_today: severeToday.length,
        low_stock_items: lowStockItems.length,
        feedback_score_30d: feedbackScore,
        top_symptom_30d: topSymptomEntry
          ? {
              symptom: topSymptomEntry[0],
              total: topSymptomEntry[1]
            }
          : null,
        top_medicine_30d: topMedicineEntry && topMedicine
          ? {
              name: topMedicine.name,
              total: topMedicineEntry[1]
            }
          : null,
        open_alerts: openAlerts
      }
    });
  })
);

module.exports = router;

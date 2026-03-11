"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "../nurse.module.css";

export default function VideoPage() {
  const [roomCode, setRoomCode] = useState("NURSE-ROOM-01");
  const [displayName, setDisplayName] = useState("พยาบาลเวร");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [provider, setProvider] = useState<"jitsi" | "meet">("jitsi");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  async function startPreview() {
    try {
      stopPreview();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraOn,
        audio: micOn
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setRunning(true);
      setMessage("เปิดกล้อง/ไมค์สำเร็จ");
    } catch (error) {
      setRunning(false);
      setMessage(error instanceof Error ? `เปิดกล้องไม่สำเร็จ: ${error.message}` : "เปิดกล้องไม่สำเร็จ");
    }
  }

  function stopPreview() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setRunning(false);
  }

  function openCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const room = roomCode.trim();
    if (!room) {
      setMessage("กรุณาใส่รหัสห้องคอล");
      return;
    }

    const name = encodeURIComponent(displayName.trim() || "Nurse");
    const encodedRoom = encodeURIComponent(room);
    const url =
      provider === "meet"
        ? `https://meet.google.com/new`
        : `https://meet.jit.si/${encodedRoom}#userInfo.displayName=\"${name}\"`;

    window.open(url, "_blank", "noopener,noreferrer");
    setMessage("เปิดห้องวิดีโอคอลแล้ว");
  }

  return (
    <>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>โหมดกล้องวิดีโอคอล</h2>
        <p className={styles.heroText}>ใช้สำหรับติดตามอาการเบื้องต้นระยะไกลแบบรวดเร็ว และลดความแออัดหน้าห้องพยาบาล</p>
      </section>

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ตั้งค่าห้องคอล</h3>
            <p className={styles.sectionSub}>เลือกแพลตฟอร์ม กำหนดชื่อผู้ใช้ และรหัสห้องก่อนเริ่ม</p>
          </div>

          <form className={styles.formGrid} onSubmit={openCall}>
            <div>
              <label className={styles.label} htmlFor="provider">
                แพลตฟอร์ม
              </label>
              <select id="provider" className={styles.select} value={provider} onChange={(event) => setProvider(event.target.value as "jitsi" | "meet")}>
                <option value="jitsi">Jitsi Meet (แนะนำ)</option>
                <option value="meet">Google Meet</option>
              </select>
            </div>

            <div>
              <label className={styles.label} htmlFor="room-code">
                รหัสห้อง
              </label>
              <input id="room-code" className={styles.input} value={roomCode} onChange={(event) => setRoomCode(event.target.value)} />
            </div>

            <div>
              <label className={styles.label} htmlFor="display-name">
                ชื่อที่แสดง
              </label>
              <input id="display-name" className={styles.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>

            <div>
              <label className={styles.label}>อุปกรณ์</label>
              <div className={styles.toolbar}>
                <button type="button" className={`${styles.button} ${cameraOn ? styles.btnSuccess : styles.btnGhost}`} onClick={() => setCameraOn((prev) => !prev)}>
                  {cameraOn ? "🎥 กล้องเปิด" : "🎥 กล้องปิด"}
                </button>
                <button type="button" className={`${styles.button} ${micOn ? styles.btnSuccess : styles.btnGhost}`} onClick={() => setMicOn((prev) => !prev)}>
                  {micOn ? "🎙 ไมค์เปิด" : "🎙 ไมค์ปิด"}
                </button>
              </div>
            </div>

            <div className={styles.toolbar}>
              <button type="button" className={`${styles.button} ${styles.btnPrimary}`} onClick={() => void startPreview()}>
                ▶ เปิดพรีวิวกล้อง
              </button>
              <button type="button" className={`${styles.button} ${styles.btnDanger}`} onClick={stopPreview}>
                ■ ปิดพรีวิว
              </button>
              <button type="submit" className={`${styles.button} ${styles.btnWarning}`}>
                📞 เปิดห้องคอล
              </button>
            </div>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>พรีวิวอุปกรณ์</h3>
            <p className={styles.sectionSub}>ตรวจภาพและเสียงก่อนเข้าห้องจริง</p>
          </div>

          <div className={styles.tableWrap} style={{ padding: 10 }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                borderRadius: 10,
                minHeight: 220,
                background: "#111"
              }}
            />
          </div>

          <p className={styles.infoText}>{running ? "สถานะ: พร้อมคอล" : "สถานะ: ยังไม่เปิดพรีวิว"}</p>
        </article>
      </section>
    </>
  );
}

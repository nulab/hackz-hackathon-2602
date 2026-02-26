import { uiImages } from "../assets/images";
import styles from "./LoadingScreen.module.css";

export const LoadingScreen = () => (
  <div className={styles.container}>
    <div className={styles.content}>
      <img src={uiImages.logo} alt="こらぼりずむ" className={styles.logo} />
      <div className={styles.spinner} />
    </div>
  </div>
);

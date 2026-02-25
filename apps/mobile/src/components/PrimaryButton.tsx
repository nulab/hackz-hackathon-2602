import { Link } from "@tanstack/react-router";
import { uiImages } from "../assets/images";
import styles from "./PrimaryButton.module.css";
import type { ReactNode } from "react";

type Props = {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
};

export function PrimaryButton({ href, onClick, className = "", children }: Props) {
  const cls = `${styles.primaryButton} ${className}`;
  const style = { backgroundImage: `url(${uiImages.button})` };

  if (href) {
    return (
      <Link to={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

import { Link } from "@tanstack/react-router";
import { uiImages } from "../assets/images";
import styles from "./PrimaryButton.module.css";
import type { ReactNode } from "react";

type Props = {
  href?: string;
  search?: Record<string, string | undefined>;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
};

export const PrimaryButton = ({ href, search, onClick, className = "", children }: Props) => {
  const cls = `${styles.primaryButton} ${className}`;
  const style = { backgroundImage: `url(${uiImages.button})` };

  if (href) {
    return (
      <Link to={href} search={search} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
};

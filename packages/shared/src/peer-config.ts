export type PeerServerConfig = {
  host: string;
  port: number;
  path: string;
  secure: boolean;
};

/** VITE_API_URL から PeerJS 接続先を導出する */
export const getPeerServerConfig = (apiUrl: string): PeerServerConfig => {
  // 絶対 URL の場合 (e.g. "http://localhost:3000/trpc")
  if (apiUrl.startsWith("http")) {
    const url = new URL(apiUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
      path: "/peerjs",
      secure: url.protocol === "https:",
    };
  }

  // 相対パスの場合 (e.g. "/trpc") → 同一オリジン
  return {
    host: window.location.hostname,
    port: Number(window.location.port) || (window.location.protocol === "https:" ? 443 : 80),
    path: "/peerjs",
    secure: window.location.protocol === "https:",
  };
};

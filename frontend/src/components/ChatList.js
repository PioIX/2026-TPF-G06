"use client";

import ChatItem from "./ChatItem.js";
import styles from "./ChatList.module.css";

export default function ChatList({chats,onSeleccionarChat,}) {
  if (chats.length === 0) {
    return (
      <p className={styles.vacio}>
        No tenés chats todavía.
      </p>
    );
  }

  return (
    <div className={styles.lista}>
      {chats.map((chat) => (
        <ChatItem
          key={chat.id_chat}
          chat={chat}
          onClick={onSeleccionarChat}
        />
      ))}
    </div>
  );
}
"use client";

import React from "react";
import ChatItem from "./ChatItem";

export default function ChatList({ chats = [], onSelectChat }) {
  if (chats.length === 0) {
    return <p className="p-4 text-center text-gray-500 text-sm">No tienes chats disponibles</p>;
  }

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      {chats.map((chat) => (
        <ChatItem key={chat.id_chat} chat={chat} onSelect={onSelectChat} />
      ))}
    </div>
  );
}
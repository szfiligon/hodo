"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
}

function randomString(length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function aesEncrypt(plainText: string, key: string, iv: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(key);
  const ivBytes = enc.encode(iv);
  const data = enc.encode(plainText);
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: ivBytes },
    cryptoKey,
    data
  );
  return window.btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export default function UnlockCodePage() {
  const [publicKey, setPublicKey] = useState("");
  const [username, setUsername] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [aesKey, setAesKey] = useState("");
  const [aesIv, setAesIv] = useState("");
  // 新增：工号
  const [empNo, setEmpNo] = useState("");
  const [unlockCode, setUnlockCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenAes = () => {
    setAesKey(randomString(32));
    setAesIv(randomString(16));
  };

  const handleGenerate = async () => {
    setError("");
    setUnlockCode("");
    if (!publicKey.trim()) {
      setError("请输入RSA公钥");
      return;
    }
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (!empNo.trim()) {
      setError("请输入工号");
      return;
    }
    if (!aesKey || !aesIv) {
      setError("请先生成AES密钥和IV");
      return;
    }
    setLoading(true);
    try {
      // yyyy-MM-dd => yyyyMMdd
      const dateStr = date.replace(/-/g, "");
      const content = `${username.trim()},${dateStr}`;
      // 1. AES加密内容
      const cipherText = await aesEncrypt(content, aesKey, aesIv);
      // 2. 拼接密钥和IV
      const keyIv = aesKey + aesIv;
      // 3. 用RSA公钥加密keyIv
      const pubKey = await importPublicKey(publicKey.trim());
      const encodedKeyIv = new TextEncoder().encode(keyIv);
      const encryptedKeyIv = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        pubKey,
        encodedKeyIv
      );
      const encryptedKeyIvBase64 = arrayBufferToBase64(encryptedKeyIv);
      // 4. 输出解锁码
      setUnlockCode(`${encryptedKeyIvBase64},${cipherText}`);

      // 5. 调用后端接口记录到服务器 CSV
      try {
        await fetch('/api/unlock-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: username.trim(), date, empNo: empNo.trim() })
        });
      } catch {
        // 忽略记录错误，不影响前端生成流程
      }
    } catch (err) {
      setError('生成失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">解锁码生成器</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">RSA公钥 (PEM格式)</label>
          <textarea
            value={publicKey}
            onChange={e => setPublicKey(e.target.value)}
            className="w-full h-28 p-3 border border-gray-300 rounded-md"
            placeholder="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">用户名</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md"
            placeholder="请输入用户名"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">工号</label>
          <input
            type="text"
            value={empNo}
            onChange={e => setEmpNo(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md"
            placeholder="请输入工号"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">日期</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md"
          />
        </div>
        <div className="flex space-x-2 items-center">
          <Button type="button" onClick={handleGenAes}>生成AES密钥和IV</Button>
          <span className="text-xs text-gray-500">密钥: {aesKey} | IV: {aesIv}</span>
        </div>
        <div>
          <Button type="button" onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? "生成中..." : "生成解锁码"}
          </Button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {unlockCode && (
          <div className="bg-gray-50 p-3 rounded-md mt-2 break-all">
            <div className="text-xs text-gray-500 mb-1">解锁码：</div>
            <div className="font-mono text-sm">{unlockCode}</div>
          </div>
        )}
      </div>
    </div>
  );
} 
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function exportCryptoKey(key: CryptoKey, type: 'pkcs8' | 'spki'): Promise<string> {
  return window.crypto.subtle.exportKey(type, key).then((exported) => {
    const exportedAsBase64 = arrayBufferToBase64(exported);
    const pemHeader = type === 'pkcs8' ? 'PRIVATE KEY' : 'PUBLIC KEY';
    const pem = `-----BEGIN ${pemHeader}-----\n` +
      exportedAsBase64.replace(/(.{64})/g, '$1\n') +
      `\n-----END ${pemHeader}-----`;
    return pem;
  });
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

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
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

async function aesDecrypt(cipherText: string, key: string, iv: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(key);
  const ivBytes = enc.encode(iv);
  const encryptedBuffer = Uint8Array.from(window.atob(cipherText), c => c.charCodeAt(0));
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: ivBytes },
    cryptoKey,
    encryptedBuffer
  );
  return new TextDecoder().decode(decrypted);
}

export default function DecryptTestPage() {
  const [encryptedAesKeyAndIv, setEncryptedAesKeyAndIv] = useState('');
  const [encryptedData, setEncryptedData] = useState('');
  const [decryptedResult, setDecryptedResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rsaPublicKey, setRsaPublicKey] = useState('');
  const [rsaPrivateKey, setRsaPrivateKey] = useState('');
  const [rsaLoading, setRsaLoading] = useState(false);
  const [rsaError, setRsaError] = useState('');
  const [plainText, setPlainText] = useState('');
  const [cipherText, setCipherText] = useState('');
  const [encryptResult, setEncryptResult] = useState('');
  const [decryptResult, setDecryptResult] = useState('');
  const [cryptoError, setCryptoError] = useState('');
  const [cryptoLoading, setCryptoLoading] = useState(false);

  // AES工具区状态
  const [aesKey, setAesKey] = useState('');
  const [aesIv, setAesIv] = useState('');
  const [aesPlain, setAesPlain] = useState('');
  const [aesCipher, setAesCipher] = useState('');
  const [aesEncryptResult, setAesEncryptResult] = useState('');
  const [aesDecryptResult, setAesDecryptResult] = useState('');
  const [aesError, setAesError] = useState('');
  const [aesLoading, setAesLoading] = useState(false);

  const handleDecrypt = async () => {
    if (!encryptedAesKeyAndIv || !encryptedData) {
      setError('请填写所有必需的字段');
      return;
    }

    setLoading(true);
    setError('');
    setDecryptedResult('');

    try {
      const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encryptedAesKeyAndIv,
          encryptedData,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setDecryptedResult(result.decryptedData);
      } else {
        setError(result.error || '解密失败');
      }
    } catch (err) {
      setError('请求失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRsa = async () => {
    setRsaLoading(true);
    setRsaError('');
    setRsaPublicKey('');
    setRsaPrivateKey('');
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );
      const privatePem = await exportCryptoKey(keyPair.privateKey, 'pkcs8');
      const publicPem = await exportCryptoKey(keyPair.publicKey, 'spki');
      setRsaPrivateKey(privatePem);
      setRsaPublicKey(publicPem);
    } catch (err) {
      setRsaError('密钥生成失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRsaLoading(false);
    }
  };

  const handleEncrypt = async () => {
    setCryptoError('');
    setEncryptResult('');
    setCryptoLoading(true);
    try {
      if (!rsaPublicKey) throw new Error('请先生成公钥');
      const pubKey = await importPublicKey(rsaPublicKey);
      const encoded = new TextEncoder().encode(plainText);
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        pubKey,
        encoded
      );
      setEncryptResult(window.btoa(String.fromCharCode(...new Uint8Array(encrypted))));
    } catch (err) {
      setCryptoError('加密失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCryptoLoading(false);
    }
  };

  // 将加解密工具区的解密函数重命名
  const handleCryptoDecrypt = async () => {
    setCryptoError('');
    setDecryptResult('');
    setCryptoLoading(true);
    try {
      if (!rsaPrivateKey) throw new Error('请先生成私钥');
      const privKey = await importPrivateKey(rsaPrivateKey);
      const encryptedBuffer = Uint8Array.from(window.atob(cipherText), c => c.charCodeAt(0));
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privKey,
        encryptedBuffer
      );
      setDecryptResult(new TextDecoder().decode(decrypted));
    } catch (err) {
      setCryptoError('解密失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCryptoLoading(false);
    }
  };

  const handleGenAes = () => {
    setAesKey(randomString(32));
    setAesIv(randomString(16));
  };

  const handleAesEncrypt = async () => {
    setAesError('');
    setAesEncryptResult('');
    setAesLoading(true);
    try {
      if (aesKey.length !== 32) throw new Error('密钥需为32位');
      if (aesIv.length !== 16) throw new Error('IV需为16位');
      setAesEncryptResult(await aesEncrypt(aesPlain, aesKey, aesIv));
    } catch (err) {
      setAesError('加密失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAesLoading(false);
    }
  };

  const handleAesDecrypt = async () => {
    setAesError('');
    setAesDecryptResult('');
    setAesLoading(true);
    try {
      if (aesKey.length !== 32) throw new Error('密钥需为32位');
      if (aesIv.length !== 16) throw new Error('IV需为16位');
      setAesDecryptResult(await aesDecrypt(aesCipher, aesKey, aesIv));
    } catch (err) {
      setAesError('解密失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAesLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">解密测试页面</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            RSA加密的AES密钥和IV (Base64格式)
          </label>
          <textarea
            value={encryptedAesKeyAndIv}
            onChange={(e) => setEncryptedAesKeyAndIv(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md"
            placeholder="输入RSA加密的AES密钥和IV..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            AES加密的密文 (Base64格式)
          </label>
          <textarea
            value={encryptedData}
            onChange={(e) => setEncryptedData(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md"
            placeholder="输入AES加密的密文..."
          />
        </div>

        <Button 
          onClick={handleDecrypt} 
          disabled={loading}
          className="w-full"
        >
          {loading ? '解密中...' : '开始解密'}
        </Button>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {decryptedResult && (
          <div>
            <label className="block text-sm font-medium mb-2">
              解密结果
            </label>
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <pre className="whitespace-pre-wrap text-sm">{decryptedResult}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h2 className="text-lg font-semibold mb-2">一键生成RSA密钥对</h2>
        <Button onClick={handleGenerateRsa} disabled={rsaLoading} className="mb-4">
          {rsaLoading ? '生成中...' : '生成RSA密钥对'}
        </Button>
        {rsaError && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md mb-2">
            <span className="text-red-600">{rsaError}</span>
          </div>
        )}
        {rsaPublicKey && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">公钥 (PEM)</label>
            <textarea
              className="w-full h-32 p-2 border border-gray-300 rounded-md text-xs"
              value={rsaPublicKey}
              readOnly
            />
          </div>
        )}
        {rsaPrivateKey && (
          <div>
            <label className="block text-sm font-medium mb-2">私钥 (PEM)</label>
            <textarea
              className="w-full h-32 p-2 border border-gray-300 rounded-md text-xs"
              value={rsaPrivateKey}
              readOnly
            />
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-purple-50 rounded-md">
        <h2 className="text-lg font-semibold mb-2">加解密工具（使用当前页面生成的密钥对）</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">明文</label>
          <textarea
            className="w-full h-20 p-2 border border-gray-300 rounded-md text-sm"
            value={plainText}
            onChange={e => setPlainText(e.target.value)}
            placeholder="输入要加密的明文..."
          />
          <Button onClick={handleEncrypt} disabled={cryptoLoading || !rsaPublicKey} className="mt-2">加密</Button>
          {encryptResult && (
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1">密文 (Base64)</label>
              <textarea className="w-full h-20 p-2 border border-gray-300 rounded-md text-xs" value={encryptResult} readOnly />
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">密文 (Base64)</label>
          <textarea
            className="w-full h-20 p-2 border border-gray-300 rounded-md text-sm"
            value={cipherText}
            onChange={e => setCipherText(e.target.value)}
            placeholder="输入要解密的密文..."
          />
          <Button onClick={handleCryptoDecrypt} disabled={cryptoLoading || !rsaPrivateKey} className="mt-2">解密</Button>
          {decryptResult && (
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1">明文</label>
              <textarea className="w-full h-20 p-2 border border-gray-300 rounded-md text-xs" value={decryptResult} readOnly />
            </div>
          )}
        </div>
        {cryptoError && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md mb-2">
            <span className="text-red-600">{cryptoError}</span>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-green-50 rounded-md">
        <h2 className="text-lg font-semibold mb-2">AES工具（AES-256-CBC）</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">密钥 (32位英文字符)</label>
            <input className="w-full p-2 border border-gray-300 rounded-md text-xs" value={aesKey} onChange={e => setAesKey(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-medium mb-1">IV (16位英文字符)</label>
            <input className="w-full p-2 border border-gray-300 rounded-md text-xs" value={aesIv} onChange={e => setAesIv(e.target.value)} />
          </div>
          <Button onClick={handleGenAes} className="h-10 mt-6">生成密钥/IV</Button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">明文</label>
          <textarea className="w-full h-16 p-2 border border-gray-300 rounded-md text-sm" value={aesPlain} onChange={e => setAesPlain(e.target.value)} placeholder="输入要加密的明文..." />
          <Button onClick={handleAesEncrypt} disabled={aesLoading} className="mt-2">AES加密</Button>
          {aesEncryptResult && (
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1">密文 (Base64)</label>
              <textarea className="w-full h-16 p-2 border border-gray-300 rounded-md text-xs" value={aesEncryptResult} readOnly />
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">密文 (Base64)</label>
          <textarea className="w-full h-16 p-2 border border-gray-300 rounded-md text-sm" value={aesCipher} onChange={e => setAesCipher(e.target.value)} placeholder="输入要解密的密文..." />
          <Button onClick={handleAesDecrypt} disabled={aesLoading} className="mt-2">AES解密</Button>
          {aesDecryptResult && (
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1">明文</label>
              <textarea className="w-full h-16 p-2 border border-gray-300 rounded-md text-xs" value={aesDecryptResult} readOnly />
            </div>
          )}
        </div>
        {aesError && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md mb-2">
            <span className="text-red-600">{aesError}</span>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h2 className="text-lg font-semibold mb-2">使用说明</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>RSA私钥已配置在 <code>public/auth</code> 文件中</li>
          <li>RSA加密的AES密钥和IV：前32位字符是AES密钥，剩余字符是IV</li>
          <li>AES使用CBC模式和AES-256加密</li>
          <li>所有输入都应该是Base64编码格式</li>
        </ul>
      </div>
    </div>
  );
} 
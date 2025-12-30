// 错误码集中管理
export const ERROR_CODES = {
  UNLOCK_ERROR: {
    code: 100001,
    msg: '账户未解锁'
  },
  // 未来可扩展更多错误码
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]; 
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { User, Edit, LogOut, Lock, Unlock } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { useToast } from "@/components/ui/use-toast"

export function UserProfile() {
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPwd, setIsChangingPwd] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const { currentUser, updateUser, logoutUser } = useTodoStore()
  const router = useRouter()
  const { toast } = useToast();

  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [trialPeriod, setTrialPeriod] = useState<boolean | null>(null);
  const [trialMessage, setTrialMessage] = useState<string>("");
  const [remainingDays, setRemainingDays] = useState<number>(0);
  const [hasUnlockRecord, setHasUnlockRecord] = useState<boolean>(false);

  // 查询解锁状态
  useEffect(() => {
    async function fetchUnlockStatus() {
      const res = await fetch("/api/unlock-status");
      if (res.ok) {
        const data = await res.json();
        setIsUnlocked(data.unlocked === true);
        setTrialPeriod(data.trialPeriod === true);
        setTrialMessage(data.message || "");
        setRemainingDays(data.remainingDays || 0);
        setHasUnlockRecord(data.hasUnlockRecord === true);
      } else {
        setIsUnlocked(false);
        setTrialPeriod(false);
        setTrialMessage("");
        setRemainingDays(0);
        setHasUnlockRecord(false);
      }
    }
    if (currentUser) fetchUnlockStatus();
  }, [currentUser]);

  const handlePasswordChange = async () => {
    // Check if user has a password set (for first-time password setting)
    const hasExistingPassword = currentUser?.password && currentUser.password.trim() !== "" && currentUser.password === '***'
    
    if (hasExistingPassword && !currentPassword.trim()) {
      setErrorMessage("当前密码是必填项")
      return
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage("新密码字段是必填项")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("新密码不匹配")
      return
    }

    if (newPassword.length < 6) {
      setErrorMessage("密码长度必须至少为6个字符")
      return
    }

    setIsChangingPwd(true)
    setErrorMessage("")
    
    try {
      const success = await updateUser({
        currentPassword: hasExistingPassword ? currentPassword.trim() : undefined,
        newPassword: newPassword.trim()
      })
      if (success) {
        setIsChangingPassword(false)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setErrorMessage("")
      } else {
        setErrorMessage("密码更改失败。当前密码可能不正确。")
      }
    } catch (error) {
      console.error('Error changing password:', error)
      setErrorMessage("更改密码时发生错误")
    } finally {
      setIsChangingPwd(false)
    }
  }

  const handleCancelPassword = () => {
    setIsChangingPassword(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setErrorMessage("")
  }

  const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePasswordChange()
    } else if (e.key === 'Escape') {
      handleCancelPassword()
    }
  }

  const handleLogout = () => {
    logoutUser()
    router.push('/login')
  }

  const handleUnlock = async () => {
    setUnlockLoading(true);
    setUnlockError("");
    try {
      const [encryptedAesKeyAndIv, encryptedData] = unlockCode.split(",");
      if (!encryptedAesKeyAndIv || !encryptedData) {
        setUnlockError("解锁码不正确");
        setUnlockLoading(false);
        return;
      }
      const res = await fetch("/api/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedAesKeyAndIv: encryptedAesKeyAndIv.trim(), encryptedData: encryptedData.trim() })
      });
      const result = await res.json();
      if (res.ok && result.success) {

        toast({ 
          title: "解锁成功", 
          description: "您的账户已成功解锁",
          variant: "success"
        });
        // 解锁成功后刷新解锁状态
        const statusRes = await fetch("/api/unlock-status");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIsUnlocked(statusData.unlocked === true);
          setTrialPeriod(statusData.trialPeriod === true);
          setTrialMessage(statusData.message || "");
          setRemainingDays(statusData.remainingDays || 0);
          setHasUnlockRecord(statusData.hasUnlockRecord === true);
        }
        setTimeout(() => {
          setUnlockDialogOpen(false);
          router.push("/"); // 解锁成功后跳转到主页面
        }, 1000);
      } else {
        setUnlockError(result.error || "解锁失败");
      }
    } catch (err) {
      setUnlockError("请求失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUnlockLoading(false);
    }
  };

  // If no user exists, don't render anything
  if (!currentUser) {
    return null
  }

  return (
    <div className="border-t p-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
            data-user-profile-trigger
          >
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900">
                {currentUser.username || '用户'}
                {(isUnlocked === false || (trialPeriod === true && !hasUnlockRecord)) && (
                  <span className="ml-2 text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">未解锁</span>
                )}
              </div>
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)]">
          <DialogHeader className="text-center pb-6">
            <DialogTitle className="text-xl font-semibold text-gray-900">用户资料</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                  <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Account Information */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-1 h-6 bg-gray-300 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-900">账户信息</h3>
              </div>
              
              <div className="space-y-4">
                {/* Username - Read Only */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">用户名</p>
                      <p className="text-sm text-gray-600">{currentUser.username || '未设置'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Password */}
                {isChangingPassword ? (
                  <div className="space-y-6 bg-gray-50 p-6 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        当前密码
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyPress}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                        placeholder="请输入当前密码"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        新密码 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyPress}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                        placeholder="请输入新密码"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        确认新密码 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyPress}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                        placeholder="请再次输入新密码"
                      />
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        onClick={handlePasswordChange}
                        disabled={isChangingPwd}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isChangingPwd ? '更改中...' : '更改密码'}
                      </Button>
                      <Button
                        onClick={handleCancelPassword}
                        variant="outline"
                        className="flex-1"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Lock className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">密码</p>
                        <p className="text-sm text-gray-600">••••••••</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setIsChangingPassword(true)}
                      variant="ghost"
                      size="sm"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Logout Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-1 h-6 bg-red-300 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-900">账户操作</h3>
              </div>
              
              {/* 统一的解锁状态显示 */}
              {trialPeriod === true && !hasUnlockRecord && (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">试</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">试用期</p>
                      <p className="text-sm text-gray-600">剩余 {remainingDays} 天试用期</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setUnlockDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="border-green-300 text-green-600 hover:bg-green-50"
                  >
                    解锁
                  </Button>
                </div>
              )}

              {/* 非试用期的解锁按钮 */}
              {trialPeriod === false && isUnlocked === false && (
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
                  <div className="flex items-center space-x-3">
                    <Unlock className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">解锁</p>
                      <p className="text-sm text-gray-600">{trialMessage || "输入解锁码进行账户解锁"}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setUnlockDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="border-yellow-300 text-yellow-600 hover:bg-yellow-50"
                  >
                    解锁
                  </Button>
                </div>
              )}
              {/* 解锁对话框 */}
              <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>账户解锁</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="请输入解锁码：密钥和IV,密文"
                      value={unlockCode}
                      onChange={e => setUnlockCode(e.target.value)}
                      disabled={unlockLoading}
                    />
                    <Button 
                      onClick={handleUnlock} 
                      disabled={unlockLoading} 
                      className="w-full flex items-center justify-center"
                    >
                      {unlockLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin h-4 w-4 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                          解锁中...
                        </span>
                      ) : "确认解锁"}
                    </Button>
                    {unlockError && <div className="text-red-600 text-sm">{unlockError}</div>}
                  </div>
                </DialogContent>
              </Dialog>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-3">
                  <LogOut className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">退出登录</p>
                    <p className="text-sm text-gray-600">退出当前账户</p>
                  </div>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  退出
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
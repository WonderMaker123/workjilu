-- AlterTable: 照片附件元数据（JSON 数组字符串），照片功能上线时补录
ALTER TABLE "Entry" ADD COLUMN "photos" TEXT NOT NULL DEFAULT '[]';

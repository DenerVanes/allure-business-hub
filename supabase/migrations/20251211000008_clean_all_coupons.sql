-- ============================================
-- Script de Limpeza: Deletar todos os cupons e usos
-- ============================================
-- 
-- ATENÇÃO: Este script irá deletar TODOS os cupons e usos de cupons do banco de dados
-- Use apenas para testes ou reset completo do sistema de cupons
-- ============================================

-- 1. Deletar todos os registros de usos de cupons (coupon_uses)
DELETE FROM public.coupon_uses;

-- 2. Deletar todas as promoções/cupons (promotions)
DELETE FROM public.promotions;

-- Verificar se foi deletado corretamente (opcional - pode comentar após confirmar)
-- SELECT COUNT(*) as total_coupon_uses FROM public.coupon_uses;
-- SELECT COUNT(*) as total_promotions FROM public.promotions;


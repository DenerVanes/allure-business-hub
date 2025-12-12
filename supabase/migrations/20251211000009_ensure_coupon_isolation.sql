-- Migração: Garantir isolamento total de cupons por salão (user_id)
-- Objetivo: Verificar e reforçar que todas as políticas RLS e queries garantem isolamento por user_id

-- 1. Verificar e garantir política RLS para SELECT em promotions (já existe, mas vamos garantir)
DROP POLICY IF EXISTS "Users can view their own promotions" ON public.promotions;
CREATE POLICY "Users can view their own promotions"
ON public.promotions
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Garantir que a política para ALL em promotions também existe e está correta
-- (Já existe "Users can manage their own promotions" mas vamos garantir)
DROP POLICY IF EXISTS "Users can manage their own promotions" ON public.promotions;
CREATE POLICY "Users can manage their own promotions"
ON public.promotions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Garantir políticas RLS para coupon_uses (já existem, mas vamos reforçar)
-- SELECT
DROP POLICY IF EXISTS "Users can view their own coupon uses" ON public.coupon_uses;
CREATE POLICY "Users can view their own coupon uses"
ON public.coupon_uses
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT (via function ou direto)
DROP POLICY IF EXISTS "Users can insert coupon uses via function" ON public.coupon_uses;
CREATE POLICY "Users can insert coupon uses via function"
ON public.coupon_uses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE
DROP POLICY IF EXISTS "Users can update their own coupon uses" ON public.coupon_uses;
CREATE POLICY "Users can update their own coupon uses"
ON public.coupon_uses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE
DROP POLICY IF EXISTS "Users can delete their own coupon uses" ON public.coupon_uses;
CREATE POLICY "Users can delete their own coupon uses"
ON public.coupon_uses
FOR DELETE
USING (auth.uid() = user_id);

-- 4. Verificar se as funções RPC validam user_id corretamente
-- (As funções já têm validação de segurança, mas vamos garantir que não há forma de contornar)

-- 5. Criar índice adicional para garantir performance nas queries filtradas por user_id
CREATE INDEX IF NOT EXISTS idx_promotions_user_status ON public.promotions(user_id, ativa, status);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user_codigo ON public.coupon_uses(user_id, codigo_cupom);

-- 6. Comentário final: Todas as queries devem usar .eq('user_id', user.id) no frontend
-- e todas as políticas RLS garantem que apenas o próprio usuário pode acessar seus dados


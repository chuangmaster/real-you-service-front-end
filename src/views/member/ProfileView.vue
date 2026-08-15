<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { sessionHttp } from '../../composables/useCustomerSession'
import type { MemberProfile } from '../../types/memberOrders'

const { t } = useI18n()

const loading = ref(true)
const error = ref('')
const profile = ref<MemberProfile | null>(null)

const editing = ref(false)
const saving = ref(false)
const saveError = ref('')
const form = reactive({
  name: '',
  phoneNumber: '',
  email: '',
  residentialAddress: ''
})

async function fetchProfile() {
  loading.value = true
  error.value = ''
  try {
    const response = await sessionHttp.get('/api/public/member/me')
    if (response.data && response.data.success) {
      profile.value = response.data.data
    } else {
      error.value = t('member.profile.errorGeneric')
    }
  } catch (err) {
    console.error('Failed to load member profile:', err)
    error.value = t('member.profile.errorGeneric')
  } finally {
    loading.value = false
  }
}

function startEditing() {
  if (!profile.value) return
  form.name = profile.value.name ?? ''
  form.phoneNumber = profile.value.phoneNumber ?? ''
  form.email = profile.value.email ?? ''
  form.residentialAddress = profile.value.residentialAddress ?? ''
  saveError.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  saveError.value = ''
}

async function handleSave() {
  saving.value = true
  saveError.value = ''
  try {
    const response = await sessionHttp.patch('/api/public/member/me', {
      name: form.name,
      phoneNumber: form.phoneNumber,
      email: form.email,
      residentialAddress: form.residentialAddress
    })
    if (response.data && response.data.success) {
      // PATCH 回應直接回傳更新後的完整 profile，不需要重新 GET。
      profile.value = response.data.data
      editing.value = false
    } else {
      saveError.value = t('member.profile.errorGeneric')
    }
  } catch (err) {
    console.error('Failed to save member profile:', err)
    saveError.value = t('member.profile.errorGeneric')
  } finally {
    saving.value = false
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div class="px-margin-mobile py-8 max-w-lg mx-auto w-full">
    <h1 class="font-headline-sm text-lg text-on-surface mb-6">{{ $t('member.profile.title') }}</h1>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <span class="material-symbols-outlined text-primary text-[48px] mb-4 block">gpp_maybe</span>
      <p class="font-body-md text-secondary">{{ error }}</p>
    </div>

    <div v-else-if="profile" class="bg-white border border-outline-variant/30 shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.sectionTitle') }}</h2>
        <button
          v-if="!editing"
          type="button"
          class="font-label-caps text-xs text-primary uppercase tracking-wider hover:text-primary-container transition-colors"
          @click="startEditing"
        >
          {{ $t('member.profile.editButton') }}
        </button>
      </div>

      <!-- READ-ONLY -->
      <div v-if="!editing" class="space-y-0">
        <div class="flex justify-between py-4 border-b border-outline-variant/20">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.name') }}</span>
          <span class="font-title-lg text-sm text-on-surface">{{ profile.name || $t('member.profile.notProvided') }}</span>
        </div>
        <div class="flex justify-between py-4 border-b border-outline-variant/20">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.phoneNumber') }}</span>
          <span class="font-data-mono text-sm text-on-surface">{{ profile.phoneNumber || $t('member.profile.notProvided') }}</span>
        </div>
        <div class="flex justify-between py-4 border-b border-outline-variant/20">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.email') }}</span>
          <span class="font-data-mono text-sm text-on-surface">{{ profile.email || $t('member.profile.notProvided') }}</span>
        </div>
        <div class="flex justify-between py-4">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.residentialAddress') }}</span>
          <span class="font-title-lg text-sm text-on-surface text-right">{{ profile.residentialAddress || $t('member.profile.notProvided') }}</span>
        </div>
      </div>

      <!-- EDIT FORM -->
      <div v-else class="space-y-4">
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.name') }}</label>
          <input v-model="form.name" type="text" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.phoneNumber') }}</label>
          <input v-model="form.phoneNumber" type="text" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.email') }}</label>
          <input v-model="form.email" type="email" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.residentialAddress') }}</label>
          <input v-model="form.residentialAddress" type="text" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>

        <p v-if="saveError" class="font-body-md text-xs text-primary">{{ saveError }}</p>

        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 bg-primary text-white px-6 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? $t('member.profile.saving') : $t('member.profile.saveButton') }}
          </button>
          <button
            type="button"
            class="flex-1 border border-outline-variant/30 text-secondary px-6 py-3 font-label-caps text-label-caps tracking-widest hover:border-primary hover:text-primary transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="cancelEditing"
          >
            {{ $t('member.profile.cancelButton') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

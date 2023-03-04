<script lang="ts" setup>
import { ref } from "vue";
import Input from "./Input.vue";
import { username } from "../state";

defineProps<{
  onJoin: (username: string, roomCode: string) => void;
  onCreate: (username: string) => void;
}>();
// const username = ref<string>(localStorage.getItem("username") ?? "");
const roomCode = ref<string>(location.hash.slice(1));
window.addEventListener("hashchange", () => {
  roomCode.value = location.hash.slice(1);
});
const obscured = ref<boolean>(false);
const onDone = () => {
  if (username.value) {
    localStorage.setItem("username", username.value);
  }
};
const usernameError = ref<boolean>(false);
const roomcodeError = ref<boolean>(false);
</script>
<template>
  <div class="flex flex-col items-center">
    <h1 class="text-center text-9xl md:text-[10rem] pt-8 md:pt-12 select-none">
      Meme Game
    </h1>
    <p class="pb-4 text-center md:pb-8 lg:mb-8 lg:text-xl">
      Provided by me and my buddy Mads
    </p>
    <Input
      class="mb-4 lg:mb-8"
      :class="{
        'outline outline-2 outline-red-500': usernameError && !username,
      }"
      placeholder="Enter username..."
      :text="username"
      :onInput="(v) => typeof v === 'string' && (username = v)"
      :name="username"
    />
    <Input
      placeholder="Enter Room Code..."
      :maxlength="10"
      :text="roomCode"
      :onInput="(v) => typeof v === 'string' && (roomCode = v)"
      :password="obscured"
      class="mb-4 lg:mb-8"
      :class="{
        'outline outline-2 outline-red-500': roomcodeError && !roomCode,
      }"
    />
    <!-- <div class="flex items-center">
          <label for="obscured" class="mr-6">Hide Room Code</label>
          <input
            type="checkbox"
            name="isObscured"
            v-model="obscured"
            id="obscured"
            class="w-8 h-8"
          />
        </div> -->
    <button
      class="mb-16 lg:mb-24 btn w-80 md:w-md lg:w-2xl"
      @click="
        () => {
          if (username && roomCode) {
            onDone();
            onJoin(username, roomCode);
          } else {
            usernameError = !username;
            roomcodeError = !roomCode;
          }
        }
      "
    >
      <span
        class="block px-8 py-4 text-xl cursor-pointer md:text-4xl md:px-12 md:py-6"
        >Join Existing Room</span
      >
    </button>
    <button
      class="btn w-80 md:w-md lg:w-2xl"
      @click="
        () => {
          if (username) {
            onDone();
            onCreate(username);
          } else {
            usernameError = true;
          }
        }
      "
    >
      <span
        class="block px-8 py-4 text-xl cursor-pointer md:text-4xl md:px-12 md:py-6"
      >
        Create New Room
      </span>
    </button>
  </div>
</template>

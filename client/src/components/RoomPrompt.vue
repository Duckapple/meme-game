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
  <div class="flex flex-col items-center justify-center w-screen h-screen">
    <h1 class="text-6xl">Meme Game</h1>
    <p>Provided by me and my buddy Mads</p>
    <Input
      class="mt-8 mb-32"
      :class="{
        'outline outline-2 outline-red-500': usernameError && !username,
      }"
      placeholder="Enter username..."
      :text="username"
      :onInput="(v) => (username = v)"
      :name="username"
    />
    <div class="flex items-end justify-center space-x-16 text-2xl">
      <div class="flex justify-center w-md">
        <button
          class="btn"
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
          <span class="block px-8 py-4 cursor-pointer">Create New Room</span>
        </button>
      </div>
      <div class="flex flex-col items-center justify-center space-y-8 w-md">
        <Input
          placeholder="Enter Room Code..."
          :maxlength="10"
          :text="roomCode"
          :onInput="(v) => (roomCode = v)"
          :password="obscured"
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
          class="btn"
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
          <span class="block px-8 py-4 cursor-pointer">Join Existing Room</span>
        </button>
      </div>
    </div>
  </div>
</template>

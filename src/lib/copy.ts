/**
 * Every word on the page, in both languages.
 *
 * Two problems are being fixed here at once, and they are the same problem.
 *
 * The first is that the page was written in English only, for readers who are
 * mostly not native English speakers. The second is that the English it was
 * written in was showing off. Sentences like "a board fed on someone else's
 * cooldown cannot know what is true this second" are pleasant to write and
 * useless to a person who wants test SOL and has never heard the word faucet.
 * Nobody reported the prose as beautiful. They reported not understanding it.
 *
 * So the English here is deliberately plain: short sentences, ordinary words,
 * and every piece of jargon either avoided or explained the first time it
 * appears. The Indonesian is a translation of the meaning, not of the grammar —
 * written the way a person would actually say it, not the way a machine
 * transliterates it.
 *
 * Both languages carry exactly the same keys, and a test holds them to that, so
 * a string added to one and forgotten in the other fails the build rather than
 * rendering an English sentence into the middle of an Indonesian paragraph.
 */

export type Lang = "en" | "id";

export const LANGS: Lang[] = ["en", "id"];

export type Copy = typeof COPY.en;

export const COPY = {
  en: {
    langName: "English",
    langSwitchLabel: "Ganti ke Bahasa Indonesia",

    nav: {
      board: "Faucet status",
      how: "How it works",
      limits: "Rules",
      faq: "Questions",
      source: "Source code",
      cta: "Get test SOL",
      backToTop: "Spigot, back to top",
      sections: "Sections",
    },

    console: {
      badge: "Solana devnet · collecting right now",
      titleA: "Free test SOL,",
      titleB: "already collected",
      sub: "Coins for testing your app. No sign-up, no captcha, no hunting across four websites. Paste your address and press one button.",

      addressLabel: "Your wallet address",
      addressPlaceholder: "Paste your devnet address here",
      amountLabel: "How much",
      amountNote: "One request per address, every 8 hours",
      amountTooBig: "More than a fair share of the account right now",

      submit: "Send it to me",
      sending: "Sending…",

      sentA: "Sent",
      sentB: "SOL.",
      receipt: "View the receipt",

      errAnswer: "The dispenser did not answer. Nothing was sent.",
      errReach: "Could not reach the dispenser. Nothing was sent.",
      blockedNoKey: "This dispenser has no key set up yet, so it cannot send anything.",
      blockedEmpty:
        "The shared account is empty right now. The list below shows which faucet is most likely to pay.",
      badLength: "That does not look like a Solana address. They are 32 to 44 characters long.",

      statBalance: "Available now",
      statFaucets: "Faucets paying",
      statNext: "Next top-up",

      reading: "Reading the account…",
      readNote: "· balance checked again every 20 seconds",
      scroll: "See which faucet is paying, and how this works",
    },

    /**
     * The words the rest of the page cannot avoid using, explained before it
     * uses them. This block is the single most requested thing on the page and
     * it did not exist: every section below assumed the reader already knew
     * what devnet and a faucet were, which is precisely backwards.
     */
    glossary: {
      label: "Plain words first",
      title: "What these words mean",
      sub: "The rest of this page uses five bits of jargon. Here they are in ordinary language, so nothing below needs guessing.",
      items: [
        {
          t: "Devnet",
          d: "A practice copy of Solana. It works exactly like the real thing, but the coins on it are worthless. Developers use it to test an app before touching real money.",
        },
        {
          t: "SOL",
          d: "The coin Solana runs on. On the real network it costs money. On devnet it is free and worth nothing — which is the whole point.",
        },
        {
          t: "Faucet",
          d: "A website that hands out free devnet coins. Each one gives a small amount, then makes you wait hours before it will give more.",
        },
        {
          t: "Airdrop",
          d: "The act of a faucet sending those free coins to your wallet. Nothing is bought and nothing is mined.",
        },
        {
          t: "The shared account",
          d: "One public wallet. We collect coins from the faucets into it, and hand them out from there. Anyone can open it and check the balance.",
        },
      ],
    },

    board: {
      label: "Faucet status",
      title: "Where the SOL comes from",
      sub: "Four faucets, and what each one did the last time we checked. You do not need any of this to get coins. It only matters on the day the shared account runs empty and you want to know which door is still worth knocking on.",
    },

    how: {
      label: "How it works",
      title: "Four steps. You only do the third one.",
      steps: [
        {
          t: "We ask the faucets, on a timer",
          d: "Two of the four faucets can be called by a program. Every few hours we ask each one for the amount it actually gives. If it pays, we wait out its full cooldown before asking again. If it refuses, we try again in an hour.",
        },
        {
          t: "Whatever arrives goes into one wallet",
          d: "Every coin we collect lands in a single public wallet. You can open it in a block explorer and count it yourself. Nothing is created here, nothing is bought, and nothing leaves except through the button at the top of this page.",
        },
        {
          t: "You take an amount",
          d: "Paste your address, pick an amount, press the button. You get a receipt you can look up. One request per address every eight hours, in six fixed sizes.",
        },
        {
          t: "Every status shows its age",
          d: "We cannot know what a faucet is doing this exact second. So each row shows what happened the last time we checked, and how long ago that was. After ten hours with no check, it stops claiming anything at all.",
        },
      ],
    },

    limits: {
      label: "Rules",
      title: "What this will not do",
      sub: "A tool that quietly broke the rules it claims to follow would be worth less than nothing. These are the four lines it does not cross, written down so you can check them against the code.",
      items: [
        {
          t: "It will not cheat the faucets",
          d: "Swapping between many wallets and many IP addresses to slip past a limit is the obvious trick, and it is the reason a project like this would deserve to be shut down. It also does not work: the faucet counts the computer asking, not the wallet receiving, so extra wallets get you nothing.",
        },
        {
          t: "It will not invent SOL",
          d: "We can only hand out what we actually collected, in sizes smaller than what came in. When the wallet is empty the page says so plainly and points you at the faucet most likely to pay instead.",
        },
        {
          t: "It will not charge you",
          d: "No token, no fee, no paid plan, nothing to connect a real wallet to. Devnet coins are given away free by design, and charging for them would be selling something that was never ours.",
        },
        {
          t: "It will not ask for your key",
          d: "Nothing here wants your seed phrase, your private key, or a signature. You paste a public address. That is the whole interaction, and even that is optional.",
        },
      ],
    },

    faq: {
      label: "Questions",
      title: "Questions people actually ask",
      items: [
        {
          q: "Do I have to open a faucet website myself?",
          a: "No. Paste an address at the top of this page, pick an amount, press the button. You get coins and a receipt. The buttons further down that open other websites are not how you get funded — they exist only for the two faucets that require a human sign-in, so that a volunteer can top the shared account up by hand when it runs empty. If you just want coins, ignore them.",
        },
        {
          q: "Why did a button send me to another website?",
          a: "Two of the four faucets sit behind a sign-in and a human check, so no program can call them. Those rows can only offer you a link. Every one of them is inside the section marked optional, and none of them is needed to get coins from this page. If a link surprised you, that is a fair complaint and the buttons at the top never do it.",
        },
        {
          q: "Where does the SOL come from?",
          a: "The same public faucets you would have opened yourself. We call the two that a program can reach, on their own published schedules, from one address, and park whatever arrives in one wallet anyone can look up. Nothing is created here and nothing is bought.",
        },
        {
          q: "Is this a way around the rate limits?",
          a: "No, and it would not work if it tried. The faucet counts the computer making the request, not the wallet receiving it, so using more wallets gets you nothing. One identity, one request per window, the published limit plus three minutes. What you save is having to track four separate countdowns, not the limit itself.",
        },
        {
          q: "What happens when the account is empty?",
          a: "The page says so in plain words and points you at whichever faucet is most likely to pay right now. It will not put you in a queue, and it will not promise a refill time it cannot know. The balance you see was read off devnet within the last twenty seconds.",
        },
        {
          q: "What does it cost?",
          a: "Nothing. No token, no fee, no paid tier, no real wallet to connect. Devnet coins are free by design.",
        },
        {
          q: "Do you want my private key?",
          a: "No. Pasting a public address is the entire interaction, and the status list works fine without one. Nothing here asks for a seed phrase, a private key, or a signature.",
        },
      ],
    },

    cta: {
      title: "Stop hunting for test SOL.",
      sub: "One address, one press, one receipt. We have been collecting on your behalf since before you opened this page.",
      primary: "Get test SOL",
      secondary: "Read the source code",
    },
  },

  id: {
    langName: "Bahasa Indonesia",
    langSwitchLabel: "Switch to English",

    nav: {
      board: "Status faucet",
      how: "Cara kerjanya",
      limits: "Aturan",
      faq: "Pertanyaan",
      source: "Kode sumber",
      cta: "Ambil SOL uji",
      backToTop: "Spigot, kembali ke atas",
      sections: "Bagian halaman",
    },

    console: {
      badge: "Solana devnet · sedang mengumpulkan",
      titleA: "SOL untuk uji coba,",
      titleB: "sudah terkumpul",
      sub: "Koin untuk menguji aplikasi Anda. Tanpa daftar, tanpa captcha, tanpa keliling empat situs. Tempel alamat dompet Anda lalu tekan satu tombol.",

      addressLabel: "Alamat dompet Anda",
      addressPlaceholder: "Tempel alamat devnet Anda di sini",
      amountLabel: "Berapa banyak",
      amountNote: "Satu permintaan per alamat, setiap 8 jam",
      amountTooBig: "Lebih besar dari jatah adil rekening saat ini",

      submit: "Kirim ke saya",
      sending: "Sedang mengirim…",

      sentA: "Terkirim",
      sentB: "SOL.",
      receipt: "Lihat bukti transaksinya",

      errAnswer: "Mesin pembagi tidak menjawab. Tidak ada yang terkirim.",
      errReach: "Mesin pembagi tidak bisa dihubungi. Tidak ada yang terkirim.",
      blockedNoKey: "Mesin pembagi ini belum punya kunci, jadi belum bisa mengirim apa pun.",
      blockedEmpty:
        "Rekening bersama sedang kosong. Daftar di bawah menunjukkan faucet mana yang paling mungkin membayar.",
      badLength: "Itu sepertinya bukan alamat Solana. Panjangnya antara 32 sampai 44 karakter.",

      statBalance: "Tersedia sekarang",
      statFaucets: "Faucet yang membayar",
      statNext: "Pengisian berikutnya",

      reading: "Sedang membaca rekening…",
      readNote: "· saldo dibaca ulang tiap 20 detik",
      scroll: "Lihat faucet mana yang membayar, dan cara kerjanya",
    },

    glossary: {
      label: "Istilah dulu",
      title: "Arti istilah di halaman ini",
      sub: "Halaman ini memakai lima istilah teknis. Ini penjelasannya dalam bahasa sehari-hari, supaya bagian di bawah tidak perlu ditebak-tebak.",
      items: [
        {
          t: "Devnet",
          d: "Salinan jaringan Solana untuk latihan. Cara kerjanya sama persis dengan yang asli, tapi koin di dalamnya tidak ada nilainya. Dipakai pengembang untuk menguji aplikasi sebelum menyentuh uang sungguhan.",
        },
        {
          t: "SOL",
          d: "Koin yang dipakai jaringan Solana. Di jaringan asli harganya nyata. Di devnet gratis dan tidak bernilai — memang itu tujuannya.",
        },
        {
          t: "Faucet",
          d: "Situs yang membagikan koin devnet gratis. Tiap situs memberi sedikit, lalu Anda harus menunggu berjam-jam sebelum boleh minta lagi.",
        },
        {
          t: "Airdrop",
          d: "Proses faucet mengirim koin gratis itu ke dompet Anda. Tidak ada yang dibeli dan tidak ada yang ditambang.",
        },
        {
          t: "Rekening bersama",
          d: "Satu dompet publik. Kami kumpulkan koin dari para faucet ke sana, lalu kami bagikan dari situ. Siapa pun boleh membukanya dan mengecek saldonya.",
        },
      ],
    },

    board: {
      label: "Status faucet",
      title: "Asal SOL-nya dari mana",
      sub: "Empat faucet, dan apa yang terjadi pada masing-masing saat terakhir kami cek. Anda tidak perlu membaca ini untuk mengambil koin. Bagian ini baru berguna kalau rekening bersama kosong dan Anda ingin tahu pintu mana yang masih layak diketuk.",
    },

    how: {
      label: "Cara kerjanya",
      title: "Empat langkah. Anda cuma mengerjakan yang ketiga.",
      steps: [
        {
          t: "Kami menagih faucet, sesuai jadwal",
          d: "Dua dari empat faucet bisa dipanggil oleh program. Tiap beberapa jam kami minta ke masing-masing sebesar jatah yang memang mereka berikan. Kalau dibayar, kami tunggu penuh masa jedanya sebelum minta lagi. Kalau ditolak, kami coba lagi satu jam kemudian.",
        },
        {
          t: "Apa pun yang masuk ditampung di satu dompet",
          d: "Semua koin yang terkumpul masuk ke satu dompet publik. Anda bisa membukanya di block explorer dan menghitungnya sendiri. Tidak ada yang dibuat di sini, tidak ada yang dibeli, dan tidak ada yang keluar selain lewat tombol di bagian atas halaman ini.",
        },
        {
          t: "Anda mengambil sejumlah koin",
          d: "Tempel alamat Anda, pilih jumlahnya, tekan tombolnya. Anda dapat bukti transaksi yang bisa dicek. Satu permintaan per alamat tiap delapan jam, dalam enam pilihan jumlah.",
        },
        {
          t: "Tiap status mencantumkan umurnya",
          d: "Kami tidak mungkin tahu kondisi sebuah faucet pada detik ini juga. Jadi tiap baris menampilkan apa yang terjadi saat pengecekan terakhir, dan sudah berapa lama. Lewat sepuluh jam tanpa pengecekan, baris itu berhenti mengklaim apa pun.",
        },
      ],
    },

    limits: {
      label: "Aturan",
      title: "Yang tidak akan dilakukan layanan ini",
      sub: "Alat yang diam-diam melanggar aturan yang diakuinya sendiri justru lebih buruk daripada tidak ada. Ini empat garis yang tidak dilewati, ditulis supaya bisa Anda cocokkan dengan kodenya.",
      items: [
        {
          t: "Tidak akan mengakali faucet",
          d: "Bergantian memakai banyak dompet dan banyak alamat IP untuk menembus batas adalah akal-akalan yang paling jelas, dan justru itu alasan proyek semacam ini pantas ditutup. Lagi pula percuma: faucet menghitung komputer yang meminta, bukan dompet yang menerima, jadi menambah dompet tidak menghasilkan apa-apa.",
        },
        {
          t: "Tidak akan mengarang SOL",
          d: "Kami hanya bisa membagikan yang benar-benar terkumpul, dalam jumlah yang lebih kecil daripada yang masuk. Kalau dompetnya kosong, halaman ini mengatakannya terus terang dan menunjuk faucet yang paling mungkin membayar.",
        },
        {
          t: "Tidak akan menarik biaya",
          d: "Tidak ada token, tidak ada biaya, tidak ada paket berbayar, tidak ada dompet asli yang perlu dihubungkan. Koin devnet memang dibagikan gratis, dan menjualnya sama saja menjual sesuatu yang bukan milik kami.",
        },
        {
          t: "Tidak akan meminta kunci Anda",
          d: "Tidak ada bagian di sini yang meminta seed phrase, kunci privat, atau tanda tangan Anda. Anda cukup menempel alamat publik. Cuma itu, dan itu pun tidak wajib.",
        },
      ],
    },

    faq: {
      label: "Pertanyaan",
      title: "Pertanyaan yang sering masuk",
      items: [
        {
          q: "Apakah saya harus membuka situs faucet sendiri?",
          a: "Tidak. Tempel alamat di bagian atas halaman ini, pilih jumlahnya, tekan tombolnya. Anda dapat koin beserta bukti transaksinya. Tombol di bagian bawah yang membuka situs lain bukan cara Anda mendapat koin — tombol itu cuma untuk dua faucet yang mewajibkan login manusia, supaya ada relawan yang bisa mengisi ulang rekening bersama saat kosong. Kalau Anda cuma mau koin, abaikan saja.",
        },
        {
          q: "Kenapa ada tombol yang malah membuka situs lain?",
          a: "Dua dari empat faucet dijaga login dan pemeriksaan manusia, jadi tidak ada program yang bisa memanggilnya. Baris itu cuma bisa menawarkan tautan. Semuanya berada di dalam bagian yang ditandai opsional, dan tidak satu pun diperlukan untuk mengambil koin dari halaman ini. Kalau tautan itu mengagetkan Anda, itu keluhan yang wajar — dan tombol di bagian atas tidak pernah begitu.",
        },
        {
          q: "SOL-nya datang dari mana?",
          a: "Dari faucet publik yang sama yang biasanya Anda buka sendiri. Kami memanggil dua yang bisa dijangkau program, sesuai jadwal resmi masing-masing, dari satu alamat, lalu menampung hasilnya di satu dompet yang bisa dilihat siapa saja. Tidak ada yang dibuat di sini dan tidak ada yang dibeli.",
        },
        {
          q: "Apakah ini cara menembus batas faucet?",
          a: "Bukan, dan kalaupun dicoba tidak akan berhasil. Faucet menghitung komputer yang meminta, bukan dompet yang menerima, jadi memakai banyak dompet tidak menambah apa-apa. Satu identitas, satu permintaan per jendela waktu, sesuai batas resmi ditambah tiga menit. Yang Anda hemat adalah repot memantau empat hitungan mundur, bukan batasnya.",
        },
        {
          q: "Kalau rekeningnya kosong bagaimana?",
          a: "Halaman ini mengatakannya terus terang dan menunjuk faucet mana yang paling mungkin membayar sekarang. Anda tidak akan dimasukkan antrean, dan kami tidak menjanjikan waktu pengisian yang memang tidak kami ketahui. Saldo yang Anda lihat dibaca dari devnet dalam dua puluh detik terakhir.",
        },
        {
          q: "Biayanya berapa?",
          a: "Tidak ada. Tidak ada token, tidak ada biaya, tidak ada paket berbayar, tidak ada dompet asli yang perlu dihubungkan. Koin devnet memang gratis.",
        },
        {
          q: "Apakah kunci privat saya diminta?",
          a: "Tidak. Menempel alamat publik sudah seluruh prosesnya, dan daftar status tetap jalan tanpa itu. Tidak ada bagian di sini yang meminta seed phrase, kunci privat, atau tanda tangan.",
        },
      ],
    },

    cta: {
      title: "Berhenti berburu SOL untuk uji coba.",
      sub: "Satu alamat, satu tekan, satu bukti transaksi. Kami sudah mengumpulkan untuk Anda bahkan sebelum halaman ini Anda buka.",
      primary: "Ambil SOL uji",
      secondary: "Baca kode sumbernya",
    },
  },
} satisfies Record<Lang, unknown>;

/**
 * The language to open in.
 *
 * A saved choice always wins — it was made on purpose. Otherwise take the
 * browser's own list, which for most readers here begins with `id`. Falling
 * back to English is the last resort, not the default assumption.
 */
export function pickLang(saved: string | null, browser: readonly string[]): Lang {
  if (saved === "en" || saved === "id") return saved;
  for (const tag of browser) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "id" || base === "in") return "id"; // `in` is the legacy tag for Indonesian
    if (base === "en") return "en";
  }
  return "en";
}

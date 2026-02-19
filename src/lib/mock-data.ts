export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  coverPhoto: string;
  friendCount: number;
  isFriend?: boolean;
  requestSent?: boolean;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  image?: string;
  likes: number;
  comments: Comment[];
  liked: boolean;
  createdAt: string;
  groupName?: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  coverPhoto: string;
  memberCount: number;
  isPublic: boolean;
  joined: boolean;
}

export const mockUsers: User[] = [
  { id: "1", name: "You", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=you", bio: "Welcome to Ujebong!", coverPhoto: "", friendCount: 42, isFriend: false },
  { id: "2", name: "Sarah Chen", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah", bio: "Photographer & traveler 📷", coverPhoto: "", friendCount: 128, isFriend: true },
  { id: "3", name: "Mike Johnson", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike", bio: "Software developer 💻", coverPhoto: "", friendCount: 95, isFriend: true },
  { id: "4", name: "Emma Wilson", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma", bio: "Coffee enthusiast ☕", coverPhoto: "", friendCount: 210, isFriend: false },
  { id: "5", name: "David Park", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david", bio: "Music producer 🎵", coverPhoto: "", friendCount: 67, isFriend: true },
  { id: "6", name: "Lisa Wang", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lisa", bio: "Fitness lover 💪", coverPhoto: "", friendCount: 183, isFriend: false, requestSent: true },
];

export const mockPosts: Post[] = [
  {
    id: "p1", userId: "2", userName: "Sarah Chen", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    content: "Just captured the most beautiful sunset at the beach! 🌅 Nature never fails to amaze me.",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop",
    likes: 24, comments: [
      { id: "c1", userId: "3", userName: "Mike Johnson", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike", content: "Stunning photo! 😍", createdAt: "2h ago" }
    ], liked: false, createdAt: "3h ago"
  },
  {
    id: "p2", userId: "3", userName: "Mike Johnson", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
    content: "Finally finished my new project! It's been a long journey but so worth it. Thanks to everyone who supported me along the way. 🚀",
    likes: 18, comments: [], liked: true, createdAt: "5h ago"
  },
  {
    id: "p3", userId: "5", userName: "David Park", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
    content: "New track dropping this Friday! 🎶 Stay tuned for something special.",
    image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=400&fit=crop",
    likes: 42, comments: [
      { id: "c2", userId: "2", userName: "Sarah Chen", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah", content: "Can't wait! 🔥", createdAt: "1h ago" },
      { id: "c3", userId: "4", userName: "Emma Wilson", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma", content: "Your music is always amazing!", createdAt: "30m ago" }
    ], liked: false, createdAt: "8h ago"
  },
  {
    id: "p4", userId: "4", userName: "Emma Wilson", userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
    content: "Morning coffee hits different when you brew it yourself ☕✨",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop",
    likes: 31, comments: [], liked: false, createdAt: "12h ago"
  },
];

export const mockGroups: Group[] = [
  { id: "g1", name: "Photography Lovers", description: "Share your best shots and get feedback from fellow photographers", coverPhoto: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&h=200&fit=crop", memberCount: 1240, isPublic: true, joined: true },
  { id: "g2", name: "Tech Developers", description: "Discuss the latest in tech, programming, and software development", coverPhoto: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=200&fit=crop", memberCount: 3500, isPublic: true, joined: false },
  { id: "g3", name: "Music Production", description: "For music producers, DJs, and sound engineers", coverPhoto: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&h=200&fit=crop", memberCount: 890, isPublic: true, joined: true },
  { id: "g4", name: "Fitness & Health", description: "Tips, routines, and motivation for a healthier lifestyle", coverPhoto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=200&fit=crop", memberCount: 2100, isPublic: false, joined: false },
];

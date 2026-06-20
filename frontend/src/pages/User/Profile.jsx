import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { User as UserIcon, Mail, Phone, Shield, Calendar, Award } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Account Profile</h1>
        <p className="text-secondary text-sm">Review your personal info and user configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* User Card */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
          <div className="bg-primary/5 text-primary p-4 rounded-full">
            <UserIcon size={36} />
          </div>
          <div>
            <h3 className="font-headline font-bold text-lg text-on-surface uppercase">{user.roll_no}</h3>
            <span className="px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-bold uppercase rounded-full tracking-wider">
              {user.role}
            </span>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl md:col-span-2 space-y-4">
          <h2 className="font-headline font-bold text-base text-on-surface mb-2">Personal Details</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="flex items-center gap-3">
              <Mail className="text-outline" size={18} />
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider">Email Address</p>
                <p className="text-sm font-semibold text-on-surface-variant">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="text-outline" size={18} />
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider">Phone Number</p>
                <p className="text-sm font-semibold text-on-surface-variant">{user.phone_no || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Shield className="text-outline" size={18} />
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider">User Type</p>
                <p className="text-sm font-semibold text-on-surface-variant uppercase">{user.user_type}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="text-outline" size={18} />
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider">Member Since</p>
                <p className="text-sm font-semibold text-on-surface-variant">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Profile;
